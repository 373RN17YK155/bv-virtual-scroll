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
  data: T | null;
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
  private mutationObserver?: MutationObserver;
  private intersectionObserver?: IntersectionObserver;
  private scrollSubscription?: Subscription;
  private observedElements = new Set<HTMLElement>(); // Track which elements are being observed
  private intersectedElements = new Set<HTMLElement>(); // Track which elements are observed by IntersectionObserver
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

    effect(() => {
      const contentContainer = this.contentContainer();

      if (contentContainer) {
        this.setupMutationObserver();
      }
    })
  }

  ngAfterContentInit(): void {
    this.setupResizeObserver();
    this.setupIntersectionObserver();
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
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    if (this.scrollSubscription) {
      this.scrollSubscription.unsubscribe();
    }
  }

  private setupMutationObserver(): void {
    if (typeof MutationObserver === 'undefined') {
      return;
    }

    this.mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Handle new child nodes added to the pool
        if (mutation.type === 'childList') {
          const addedNodes = Array.from(mutation.addedNodes)
            .filter((node): node is HTMLElement => node instanceof HTMLElement);

          addedNodes.forEach((element) => {
            // Cache initial size and offset for the element
            const dataIndex = element.getAttribute('data-index');
            if (dataIndex !== null) {
              const index = parseInt(dataIndex, 10);
              this.cacheElementMeasurement(element, index);
            }

            // Register element in both ResizeObserver and IntersectionObserver
            this.observeElement(element);
            this.observeElementIntersection(element);
          });
        }

        // Handle data-index attribute changes
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-index') {
          const element = mutation.target as HTMLElement;
          const dataIndex = element.getAttribute('data-index');

          if (dataIndex !== null) {
            const index = parseInt(dataIndex, 10);

            // Check if cache has data for new index, add if missing
            if (!this.itemSizeCache.has(index)) {
              this.cacheElementMeasurement(element, index);
            }

            // Ensure element is being observed by both observers
            this.observeElement(element);
            this.observeElementIntersection(element);
          }
        }
      }
    });

    const contentContainer = this.contentContainer();
    if (contentContainer) {
      this.mutationObserver.observe(contentContainer.nativeElement, {
        childList: true,      // Watch for added/removed nodes
        subtree: false,       // Don't watch descendants
        attributes: true,     // Watch for attribute changes
        attributeFilter: ['data-index'], // Only watch data-index attribute
        characterData: false
      });
    }
  }

  /**
   * Observe an element with ResizeObserver
   * Prevents duplicate observations
   */
  private observeElement(element: HTMLElement): void {
    if (!this.resizeObserver) return;

    // Only observe if not already being observed
    if (!this.observedElements.has(element)) {
      this.resizeObserver.observe(element);
      this.observedElements.add(element);
    }
  }

  /**
   * Observe an element with IntersectionObserver
   * Prevents duplicate observations
   */
  private observeElementIntersection(element: HTMLElement): void {
    if (!this.intersectionObserver) return;

    // Only observe if not already being observed
    if (!this.intersectedElements.has(element)) {
      this.intersectionObserver.observe(element);
      this.intersectedElements.add(element);
    }
  }

  /**
   * Cache element measurement (size and offset)
   */
  private cacheElementMeasurement(element: HTMLElement, index: number): void {
    const rect = element.getBoundingClientRect();
    const size = this.direction() === 'vertical' ? rect.height : rect.width;

    // Only cache if size is valid (> 0)
    if (size > 0) {
      const previousItemSize = this.itemSizeCache.get(index - 1)?.size ?? this.beforeContentSize();
      const previousItemOffset = this.itemSizeCache.get(index - 1)?.offset ?? 0;
      const offset = previousItemOffset + previousItemSize;

      this.itemSizeCache.set(index, { size, offset });
    }
  }

  /**
   * Get minimum and maximum data indices currently in the pool
   */
  private getMinMaxPoolIndices(): { minIndex: number; maxIndex: number; minItem: VirtualItem<T> | null; maxItem: VirtualItem<T> | null } {
    const pool = this.virtualItems();

    if (pool.length === 0) {
      return { minIndex: -1, maxIndex: -1, minItem: null, maxItem: null };
    }

    let minIndex = Infinity;
    let maxIndex = -Infinity;
    let minItem: VirtualItem<T> | null = null;
    let maxItem: VirtualItem<T> | null = null;

    for (const item of pool) {
      if (item.index >= 0 && item.data !== null) {
        if (item.index < minIndex) {
          minIndex = item.index;
          minItem = item;
        }
        if (item.index > maxIndex) {
          maxIndex = item.index;
          maxItem = item;
        }
      }
    }

    return { minIndex, maxIndex, minItem, maxItem };
  }

  /**
   * Setup IntersectionObserver to track when elements enter/exit viewport
   * Used for intelligent element recycling
   */
  private setupIntersectionObserver(): void {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    const scrollContainer = this.scrollContainer();
    if (!scrollContainer) return;

    // Create IntersectionObserver with the scroll container as root
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          const dataIndex = element.getAttribute('data-index');

          if (dataIndex === null) continue;

          const index = parseInt(dataIndex, 10);

          // Element is exiting viewport - potential candidate for recycling
          if (!entry.isIntersecting) {
            const { minIndex, maxIndex } = this.getMinMaxPoolIndices();
            const items = this.items();

            // Skip if no valid pool or insufficient data
            if (minIndex === -1 || maxIndex === -1 || items.length === 0) continue;

            // Determine scroll direction and recycling opportunity
            const scrollOffset = this.scrollOffset();
            const elementOffset = this.itemSizeCache.get(index)?.offset ?? 0;

            // Element is above viewport (scrolling down)
            if (elementOffset < scrollOffset && index === minIndex) {
              // Check if there's data to load below
              const nextIndex = maxIndex + 1;
              if (nextIndex < items.length) {
                // Note: Actual recycling is handled by recalculate()
                // This observer primarily tracks intersection state
                // We could add a flag here for optimization, but the scroll
                // listener already handles recycling efficiently
              }
            }

            // Element is below viewport (scrolling up)
            if (elementOffset > scrollOffset + this.viewportSize() && index === maxIndex) {
              // Check if there's data to load above
              const prevIndex = minIndex - 1;
              if (prevIndex >= 0) {
                // Note: Actual recycling is handled by recalculate()
              }
            }
          }

          // Element is entering viewport
          if (entry.isIntersecting) {
            // Cache measurement when element enters viewport
            if (!this.itemSizeCache.has(index)) {
              this.cacheElementMeasurement(element, index);
            }
          }
        }
      },
      {
        root: scrollContainer.nativeElement,
        // Use margin to detect elements slightly before they enter viewport
        rootMargin: '100px 0px 100px 0px',
        threshold: [0, 0.1, 0.5, 0.9, 1.0]
      }
    );
  }

  /**
   * Setup ResizeObserver for dynamic size tracking
   *
   * Coordination with MutationObserver:
   * - MutationObserver caches initial size immediately when data-index changes
   * - ResizeObserver handles subsequent size changes (content updates, dynamic content)
   * - This dual approach ensures we capture size early (MutationObserver) and
   *   track ongoing changes (ResizeObserver) for maximum accuracy
   * - Both observers work together: initial cache prevents flicker, resize tracking
   *   maintains accuracy as content loads/changes
   */
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
          // Works with MutationObserver's initial caching for complete coverage
          if (size > 0 && (cachedSize === undefined || Math.abs(cachedSize - size) > 0.5)) {
            const estimatedSize = cachedSize ?? this.getEstimatedSize();
            const sizeDifference = size - estimatedSize;

            const previousItemSize = this.itemSizeCache.get(index - 1)?.size ?? this.beforeContentSize();
            const previousItemOffset = this.itemSizeCache.get(index - 1)?.offset ?? 0;
            const offset = previousItemOffset + previousItemSize;

            this.itemSizeCache.set(index, { size, offset });

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
      this.observeElement(scrollContainer.nativeElement);
    }

    // Observe before/after content (if they exist)
    const beforeContent = this.beforeContent();
    if (beforeContent) {
      this.observeElement(beforeContent.nativeElement);
    }

    const afterContent = this.afterContent();
    if (afterContent) {
      this.observeElement(afterContent.nativeElement);
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

  /**
   * Setup scroll listener for precise position tracking
   *
   * Note: Both scroll listener and IntersectionObserver are used:
   * - Scroll listener: Handles precise position tracking and triggers recalculation
   *   for smooth, accurate virtual scrolling
   * - IntersectionObserver: Optimizes by tracking element visibility states and
   *   caching measurements when elements enter viewport. Reduces unnecessary
   *   calculations and provides additional context for recycling decisions.
   *
   * Both work together for optimal performance - scroll listener provides
   * continuous updates while IntersectionObserver adds intelligent caching.
   */
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
      return pool.map((_, poolIndex) => {
        const dataIdx = bufferedStart + poolIndex;
        const isVisible = dataIdx <= bufferedEnd && dataIdx < items.length;
        const index = isVisible ? dataIdx : -999999999;
        const offset = isVisible ? measurements[dataIdx].offset : -999999999;
        const data = isVisible ? items[dataIdx] : null;

        return {
          poolIndex,
          index,
          offset,
          data,
        }
      });
    });

    this.cdr.markForCheck();
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

