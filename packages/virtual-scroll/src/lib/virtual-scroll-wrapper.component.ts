import {
  Component,
  input,
  contentChild,
  viewChild,
  ElementRef,
  AfterContentInit,
  OnDestroy,
  ChangeDetectorRef,
  TrackByFunction,
  ChangeDetectionStrategy,
  TemplateRef,
  signal,
  computed,
  effect,
  untracked,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { fromEvent, Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

export type ScrollDirection = 'vertical' | 'horizontal';

interface VirtualItem<T> {
  data: T;
  index: number;      // Data index (changes on scroll)
  offset: number;     // Position offset from top/left
  poolIndex: number;  // Pool index (never changes - for stable tracking)
}

interface ItemMeasurement {
  size: number;
  offset: number;
}



@Component({
  selector: 'bv-virtual-scroll-wrapper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './virtual-scroll-wrapper.component.html',
  styleUrls: ['./virtual-scroll-wrapper.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'virtual-scroll-wrapper'
  }
})
export class VirtualScrollWrapperComponent<T = any> implements AfterContentInit, OnDestroy {
  // Inputs as signals
  items = input<T[]>([]);
  itemSize = input<number | undefined>(undefined); // Fixed size mode (optional)
  bufferSize = input<number>(3);
  direction = input<ScrollDirection>('vertical');
  trackBy = input<TrackByFunction<T> | undefined>(undefined);

  // Content children as signals
  itemTemplate = contentChild<TemplateRef<any>>('virtualScrollItem');
  beforeTemplate = contentChild<TemplateRef<any>>('virtualScrollBefore');
  afterTemplate = contentChild<TemplateRef<any>>('virtualScrollAfter');

  // View children as signals
  scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');
  contentContainer = viewChild<ElementRef<HTMLDivElement>>('contentContainer');
  beforeContent = viewChild<ElementRef<HTMLDivElement>>('beforeContent');
  afterContent = viewChild<ElementRef<HTMLDivElement>>('afterContent');

  // Signals for reactive state management
  private scrollOffset = signal(0);
  private viewportSize = signal(0);
  private itemSizeCache = new Map<number, ItemMeasurement>(); // Stores size and offset
  private resizeObserver?: ResizeObserver;
  private scrollSubscription?: Subscription;
  private defaultItemSize = 50; // Default estimated size for unmeasured items

  // Virtual items pool
  virtualItems = signal<VirtualItem<T>[]>([]);
  totalSize = signal(0);

  // Computed values
  isVertical = computed(() => this.direction() === 'vertical');

  // Calculate fixed pool size based on viewport and buffer
  poolSize = computed(() => {
    const viewport = this.viewportSize();
    const buffer = this.bufferSize();
    const itemSize = this.itemSize() ?? this.defaultItemSize;

    if (viewport === 0) return buffer * 2 + 1;

    // Calculate how many items fit in viewport
    const viewportItems = Math.ceil(viewport / itemSize);
    return viewportItems + (buffer * 2);
  });

  // Automatically track before/after content sizes
  beforeContentSize = computed(() => {
    const beforeContent = this.beforeContent();
    if (!beforeContent) return 0;

    const rect = beforeContent.nativeElement.getBoundingClientRect();
    return this.direction() === 'vertical' ? rect.height : rect.width;
  });

  afterContentSize = computed(() => {
    const afterContent = this.afterContent();
    if (!afterContent) return 0;

    const rect = afterContent.nativeElement.getBoundingClientRect();
    return this.direction() === 'vertical' ? rect.height : rect.width;
  });

  // Calculate after content offset: last item's offset + last item's size
  afterContentOffset = computed(() => {
    return this.totalSize() - this.afterContentSize();
  });

  constructor(private cdr: ChangeDetectorRef) {
    // Effect to initialize pool ONLY when items or pool size changes
    // DO NOT call recalculate here - it will be called by scroll/resize handlers
    effect(() => {
      const items = this.items();
      const pool = this.poolSize();

      if (!items || items.length === 0) {
        untracked(() => this.virtualItems.set([]));
        return;
      }

      // Use untracked to read virtualItems without creating dependency
      // This prevents infinite loop when virtualItems is updated
      const currentPoolLength = untracked(() => this.virtualItems().length);
      const targetPoolSize = Math.min(pool, items.length);

      // Only initialize pool if size changed
      // Don't call recalculate here - it causes infinite loop
      if (currentPoolLength !== targetPoolSize) {
        untracked(() => this.initializePool());
      }
    });
  }

  ngAfterContentInit(): void {
    this.setupResizeObserver();
    this.measureViewport();
    this.initializeTotalSize();
    this.setupScrollListener();

    // Give time for pool to initialize, then recalculate
    setTimeout(() => this.recalculate(), 0);
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.scrollSubscription) {
      this.scrollSubscription.unsubscribe();
    }
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      let totalSizeAdjustment = 0;
      let needsRecalc = false;

      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        const indexStr = element.getAttribute('data-index');

        if (indexStr !== null) {
          const index = parseInt(indexStr, 10);
          const size = this.direction() === 'vertical'
            ? entry.contentRect.height
            : entry.contentRect.width;

          const cachedData = this.itemSizeCache.get(index);
          const cachedSize = cachedData?.size;

          // Only update if size is valid (> 0) and changed significantly
          // Prevents caching 0 sizes when elements haven't fully rendered
          if (size > 0 && (cachedSize === undefined || Math.abs(cachedSize - size) > 0.5)) {
            const estimatedSize = cachedSize ?? this.getEstimatedSize();
            const sizeDifference = size - estimatedSize;

            // Note: offset will be updated in calculateMeasurements during recalc
            // For now, we keep the old offset if it exists
            const oldOffset = cachedData?.offset ?? 0;
            this.itemSizeCache.set(index, { size, offset: oldOffset });

            // Adjust total size incrementally
            totalSizeAdjustment += sizeDifference;
            needsRecalc = true;
          }
        }

        // Check if it's the before or after content element
        if (element.classList.contains('virtual-scroll-before') ||
          element.classList.contains('virtual-scroll-after')) {
          // Content size will be automatically recomputed by the computed signals
          // We'll recalculate totalSize completely since before/after changed
          needsRecalc = true;
        }
      }

      // Apply incremental adjustment to total size (only for items)
      if (totalSizeAdjustment !== 0) {
        this.totalSize.update(current => current + totalSizeAdjustment);
      }

      if (needsRecalc) {
        // Recalculate totalSize to include current before/after sizes
        this.updateTotalSize();
        this.recalculate();
      }
    });

    // Observe viewport size changes
    const scrollContainer = this.scrollContainer();
    if (scrollContainer) {
      this.resizeObserver.observe(scrollContainer.nativeElement);
    }

    // Observe before/after content size changes
    const beforeContent = this.beforeContent();
    if (beforeContent) {
      this.resizeObserver.observe(beforeContent.nativeElement);
    }

    const afterContent = this.afterContent();
    if (afterContent) {
      this.resizeObserver.observe(afterContent.nativeElement);
    }
  }

  private measureViewport(): void {
    const scrollContainer = this.scrollContainer();
    if (!scrollContainer) return;

    const rect = scrollContainer.nativeElement.getBoundingClientRect();
    const size = this.direction() === 'vertical' ? rect.height : rect.width;
    this.viewportSize.set(size);
  }

  private initializeTotalSize(): void {
    // Initialize total size with default item size estimate + before/after content
    const itemSize = this.itemSize() ?? this.defaultItemSize;
    const estimatedItemsTotal = this.items().length * itemSize;
    const beforeSize = this.beforeContentSize();
    const afterSize = this.afterContentSize();
    this.totalSize.set(beforeSize + estimatedItemsTotal + afterSize);
  }

  private initializePool(): void {
    const items = this.items();
    const pool = Math.min(this.poolSize(), items.length);

    // Create fixed array of virtual items with stable pool indices
    const fixedPool: VirtualItem<T>[] = [];
    for (let i = 0; i < pool; i++) {
      fixedPool.push({
        data: items[i],
        index: i,
        offset: 0,
        poolIndex: i // Stable index that never changes
      });
    }

    this.virtualItems.set(fixedPool);

    // Now calculate correct positions
    this.recalculate();
  }

  private updateTotalSize(): void {
    // Recalculate total size: beforeContent + all items + afterContent
    const items = this.items();
    let itemsTotal = 0;

    for (let i = 0; i < items.length; i++) {
      const cachedData = this.itemSizeCache.get(i);
      itemsTotal += cachedData?.size ?? this.defaultItemSize;
    }

    const beforeSize = this.beforeContentSize();
    const afterSize = this.afterContentSize();
    this.totalSize.set(beforeSize + itemsTotal + afterSize);
  }

  private setupScrollListener(): void {
    const scrollContainer = this.scrollContainer();
    if (!scrollContainer) return;

    // Use RxJS fromEvent for better scroll handling
    this.scrollSubscription = fromEvent(scrollContainer.nativeElement, 'scroll')
      .pipe(
        throttleTime(16, undefined, { leading: true, trailing: true }) // ~60fps
      )
      .subscribe(() => {
        this.updateScrollPosition();
      });
  }

  private updateScrollPosition(): void {
    const scrollContainer = this.scrollContainer();
    if (!scrollContainer) return;

    const element = scrollContainer.nativeElement;
    const offset = this.direction() === 'vertical'
      ? element.scrollTop
      : element.scrollLeft;

    this.scrollOffset.set(offset);
    this.recalculate();
  }

  private recalculate(): void {
    const items = this.items();
    if (!items || items.length === 0) {
      this.virtualItems.set([]);
      this.totalSize.set(0);
      return;
    }

    const pool = this.virtualItems();
    if (pool.length === 0) {
      // Pool not initialized yet
      return;
    }

    const viewport = this.viewportSize();
    const scroll = this.scrollOffset();

    // Calculate item positions and find visible range
    const measurements = this.calculateMeasurements();

    // Find visible range (measurements already include before content offset)
    const { startIndex, endIndex } = this.findVisibleRange(
      scroll,
      viewport,
      measurements
    );

    // Apply buffer
    const bufferSize = this.bufferSize();
    const bufferedStart = Math.max(0, startIndex - bufferSize);
    const bufferedEnd = Math.min(items.length - 1, endIndex + bufferSize);

    // Update existing pool items instead of creating new array
    this.virtualItems.update(pool => {
      const updatedPool = [...pool]; // Shallow copy for change detection

      for (let poolIdx = 0; poolIdx < pool.length; poolIdx++) {
        const dataIdx = bufferedStart + poolIdx;

        if (dataIdx <= bufferedEnd && dataIdx < items.length) {
          // Update existing pool item with new data
          updatedPool[poolIdx] = {
            poolIndex: poolIdx,
            data: items[dataIdx],
            index: dataIdx,
            offset: measurements[dataIdx].offset
          };
        }
      }

      return updatedPool;
    });

    this.cdr.markForCheck();

    // Observe new elements for size changes
    this.observeVisibleElements();
  }

  private calculateMeasurements(): ItemMeasurement[] {
    return this.items().map((_, index) => {
      const itemSize = this.itemSize();
      const cachedData = this.itemSizeCache.get(index);
      const size = itemSize !== undefined ? itemSize : cachedData?.size ?? this.defaultItemSize;
      const previousItemSize = this.itemSizeCache.get(index - 1)?.size ?? this.beforeContentSize();
      const previousItemOffset = this.itemSizeCache.get(index - 1)?.offset ?? 0;
      const offset = previousItemOffset + previousItemSize;

      this.itemSizeCache.set(index, { size, offset });

      return { size, offset };
    });
  }

  private getEstimatedSize(): number {
    // Use fixed size if provided
    const itemSize = this.itemSize();
    if (itemSize !== undefined) {
      return itemSize;
    }

    // Always use default size for unmeasured items (consistency)
    // This prevents total size from fluctuating as we measure items
    // The ResizeObserver handles incremental adjustments
    return this.defaultItemSize;
  }

  private findVisibleRange(
    scroll: number,
    viewport: number,
    measurements: ItemMeasurement[]
  ): { startIndex: number; endIndex: number } {
    if (measurements.length === 0) {
      return { startIndex: 0, endIndex: 0 };
    }

    const viewportEnd = scroll + viewport;

    // Binary search for start
    let startIndex = 0;
    let left = 0;
    let right = measurements.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const measurement = measurements[mid];
      const itemEnd = measurement.offset + measurement.size;

      if (itemEnd <= scroll) {
        left = mid + 1;
      } else if (measurement.offset > scroll) {
        right = mid - 1;
      } else {
        startIndex = mid;
        break;
      }
    }

    if (left > right) {
      startIndex = left < measurements.length ? left : measurements.length - 1;
    }

    // Binary search for end
    let endIndex = startIndex;
    left = startIndex;
    right = measurements.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const measurement = measurements[mid];

      if (measurement.offset < viewportEnd) {
        endIndex = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return { startIndex, endIndex };
  }

  private observeVisibleElements(): void {
    const contentContainer = this.contentContainer();
    if (!this.resizeObserver || !contentContainer) return;

    // Disconnect existing observations on content elements
    // (keeping scroll container observation)

    // Observe all virtual item elements
    const elements = contentContainer.nativeElement.querySelectorAll('[data-index]');
    elements.forEach((element) => {
      this.resizeObserver!.observe(element as HTMLElement);
    });
  }

  trackByPoolIndex(_: number, item: VirtualItem<T>): number {
    // Track by stable pool index - this ensures DOM nodes are never recreated
    return item.poolIndex;
  }

  getItemContext(item: VirtualItem<T>) {
    return {
      $implicit: item.data,
      index: item.index,
    };
  }
}

