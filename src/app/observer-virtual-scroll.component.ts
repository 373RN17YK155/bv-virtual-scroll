import {
  Component,
  computed,
  effect,
  ElementRef,
  input,
  signal,
  viewChild,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { fromEvent, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

interface VirtualItem<T> {
  data: T;
  offset: number;
  index: number;
}

interface CacheItem {
  height: number;
  offset: number;
}

@Component({
  selector: 'app-observer-virtual-scroll',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #scrollContainer class="scroll-container">
      <div #itemsContainer class="items-container" [style.height.px]="containerHeight()">
        @for (item of itemsForDraw(); track item.index) {
          <div
            class="virtual-item"
            [attr.data-index]="item.index"
            [style.transform]="'translateY(' + item.offset + 'px)'"
          >
            <ng-container *ngTemplateOutlet="itemTemplate(); context: { $implicit: item.data, index: item.index }"></ng-container>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .scroll-container {
      overflow-y: auto;
      overflow-x: hidden;
      height: 100%;
      width: 100%;
      position: relative;
    }

    .items-container {
      position: relative;
      width: 100%;
    }

    .virtual-item {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      will-change: transform;
      contain: layout style paint;
    }
  `]
})
export class ObserverVirtualScrollComponent<T> implements OnDestroy {
  // Inputs
  items = input.required<T[]>();
  defaultItemHeight = input<number>(50);
  bufferSize = input<number>(3); // Number of extra items to render above/below viewport
  itemTemplate = input.required<any>();

  // View children
  scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');
  itemsContainer = viewChild<ElementRef<HTMLDivElement>>('itemsContainer');

  // Computed
  containerHeight = signal<number>(0);
  itemsForDraw = signal<VirtualItem<T>[]>([]);

  // Cache for item dimensions
  private itemsCache = new Map<number, CacheItem>();

  // Observers
  private mutationObserver?: MutationObserver;
  private intersectionObserver?: IntersectionObserver;
  private resizeObserver?: ResizeObserver;

  // Internal state
  private scrollContainerHeight = signal<number>(0);
  private isInitialized = false;
  private lastVisibleIndexes = new Set<number>();
  private scrollDirection: 'down' | 'up' = 'down';

  // Scroll subscription for fast scrolling fallback
  private scrollSubscription?: Subscription;

  // Track items currently in transition to prevent rapid reassignments
  private itemsInTransition = new Map<number, boolean>();
  private pendingUpdates = new Map<number, number>(); // oldIndex -> newIndex

  constructor() {
    // Initialize container height based on items
    effect(() => {
      const items = this.items();
      const defaultHeight = this.defaultItemHeight();
      this.containerHeight.set(items.length * defaultHeight);
    });

    // Setup observers when view is ready
    effect(() => {
      const scrollContainer = this.scrollContainer()?.nativeElement;
      const itemsContainer = this.itemsContainer()?.nativeElement;

      if (scrollContainer && itemsContainer && !this.isInitialized) {
        this.isInitialized = true;
        this.scrollContainerHeight.set(scrollContainer.clientHeight);
        this.setupObservers(scrollContainer, itemsContainer);
        this.initializeItems();
      }
    }, { allowSignalWrites: true });
  }

  private setupObservers(scrollContainer: HTMLElement, itemsContainer: HTMLElement): void {
    // Mutation Observer - tracks when items are added to DOM
    this.mutationObserver = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.mutationObserver.observe(itemsContainer, {
      childList: true,
      subtree: false,
    });

    // Intersection Observer - tracks item visibility for virtual scrolling
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        this.handleIntersections(entries);
      },
      {
        root: scrollContainer,
        rootMargin: `${this.defaultItemHeight() * this.bufferSize()}px`,
        threshold: [0, 0.1, 0.9, 1],
      }
    );

    // Resize Observer - handles container size changes
    this.resizeObserver = new ResizeObserver((entries) => {
      this.handleResize(entries);
    });

    this.resizeObserver.observe(scrollContainer);

    // Scroll observable as fallback for fast scrolling/thumb dragging
    this.scrollSubscription = fromEvent(scrollContainer, 'scroll')
      .pipe(
        debounceTime(150) // Wait for scrolling to settle
      )
      .subscribe(() => {
        this.handleScrollEnd(scrollContainer);
      });
  }

  private initializeItems(): void {
    const viewportHeight = this.scrollContainerHeight();
    const defaultHeight = this.defaultItemHeight();
    const buffer = this.bufferSize();
    const items = this.items();

    console.log('Initializing items:', {
      viewportHeight,
      defaultHeight,
      buffer,
      totalItems: items.length
    });

    // Calculate how many items needed to fill viewport + buffer
    const itemsNeeded = Math.min(
      Math.ceil((viewportHeight + defaultHeight * buffer * 2) / defaultHeight),
      items.length
    );

    console.log('Items needed:', itemsNeeded);

    const initialItems: VirtualItem<T>[] = [];
    let currentOffset = 0;

    for (let i = 0; i < itemsNeeded; i++) {
      initialItems.push({
        data: items[i],
        offset: currentOffset,
        index: i,
      });

      // Use cached height if available, otherwise use default
      const cachedItem = this.itemsCache.get(i);
      const height = cachedItem?.height ?? defaultHeight;

      this.itemsCache.set(i, {
        height,
        offset: currentOffset,
      });

      currentOffset += height;
    }

    console.log('Initial items created:', initialItems.length);
    this.itemsForDraw.set(initialItems);
  }

  private handleMutations(mutations: MutationRecord[]): void {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement && node.classList.contains('virtual-item')) {
          const index = parseInt(node.getAttribute('data-index') || '0', 10);
          const height = node.offsetHeight;
          const cachedItem = this.itemsCache.get(index);

          console.log('Item added to DOM:', { index, height, cachedHeight: cachedItem?.height });

          // Update cache with actual height
          if (cachedItem) {
            const heightDiff = height - cachedItem.height;

            if (heightDiff !== 0) {
              console.log('Height adjusted:', { index, oldHeight: cachedItem.height, newHeight: height, diff: heightDiff });
              cachedItem.height = height;
              this.updateOffsetsFromIndex(index + 1, heightDiff);
              this.updateContainerHeight();
            }
          }

          // Observe this element for intersection
          if (this.intersectionObserver) {
            this.intersectionObserver.observe(node);
          }
        }
      });

      mutation.removedNodes.forEach((node) => {
        if (node instanceof HTMLElement && this.intersectionObserver) {
          this.intersectionObserver.unobserve(node);
        }
      });
    });
  }

  private handleIntersections(entries: IntersectionObserverEntry[]): void {
    entries.forEach((entry) => {
      if (entry.target instanceof HTMLElement) {
        const index = parseInt(entry.target.getAttribute('data-index') || '0', 10);

        if (entry.isIntersecting) {
          // Item is entering/visible
          this.lastVisibleIndexes.add(index);
          console.log('Item entering viewport:', index);

          // Clear transition flag when item becomes visible
          this.itemsInTransition.delete(index);
        } else {
          // Item is leaving viewport - this is where we reuse it!
          this.lastVisibleIndexes.delete(index);
          console.log('Item leaving viewport:', index);

          // Check if this item is already in transition
          if (this.itemsInTransition.has(index)) {
            console.log('⚠️ Item', index, 'already in transition, skipping reuse');
            return;
          }

          // Reuse this item for a different data element
          this.reuseItemElement(index, entry.target as HTMLElement);
        }
      }
    });
  }

  private handleScrollEnd(scrollContainer: HTMLElement): void {
    const scrollTop = scrollContainer.scrollTop;
    const viewportHeight = scrollContainer.clientHeight;
    const defaultHeight = this.defaultItemHeight();
    const buffer = this.bufferSize();
    const items = this.items();

    console.log('🔄 Scroll ended, checking range:', scrollTop);

    // Calculate which items should be visible based on scroll position
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / defaultHeight) - buffer
    );

    const itemsNeeded = Math.ceil((viewportHeight + defaultHeight * buffer * 2) / defaultHeight);
    const endIndex = Math.min(
      items.length - 1,
      startIndex + itemsNeeded
    );

    const currentItems = this.itemsForDraw();
    const currentIndexes = new Set(currentItems.map(item => item.index));

    // Check if current range significantly different from what should be visible
    const needsUpdate =
      currentItems.length === 0 ||
      startIndex < Math.min(...Array.from(currentIndexes)) - buffer ||
      endIndex > Math.max(...Array.from(currentIndexes)) + buffer;

    if (needsUpdate) {
      console.log('⚡ Fast scroll detected, updating range:', { startIndex, endIndex });
      this.renderItemRange(startIndex, endIndex);
    }
  }

  private renderItemRange(startIndex: number, endIndex: number): void {
    const items = this.items();
    const newItems: VirtualItem<T>[] = [];

    for (let i = startIndex; i <= endIndex; i++) {
      if (i >= 0 && i < items.length) {
        const offset = this.calculateOffset(i);

        newItems.push({
          data: items[i],
          offset,
          index: i,
        });

        // Ensure item is cached
        if (!this.itemsCache.has(i)) {
          this.itemsCache.set(i, {
            height: this.defaultItemHeight(),
            offset: offset
          });
        }
      }
    }

    console.log('📦 Rendering new range:', { start: startIndex, end: endIndex, count: newItems.length });
    this.itemsForDraw.set(newItems);
  }

  private reuseItemElement(leavingIndex: number, element: HTMLElement): void {
    const currentItems = this.itemsForDraw();
    const items = this.items();

    if (this.lastVisibleIndexes.size === 0) return;

    // Get current rendered indexes
    const currentIndexes = new Set(currentItems.map(item => item.index));
    const renderedArray = Array.from(currentIndexes).sort((a, b) => a - b);
    const minRendered = renderedArray[0];
    const maxRendered = renderedArray[renderedArray.length - 1];

    // Determine scroll direction by comparing leaving index with visible indexes
    const visibleArray = Array.from(this.lastVisibleIndexes);
    const minVisible = Math.min(...visibleArray);
    const maxVisible = Math.max(...visibleArray);

    let newIndex: number | null = null;

    // If item leaving from top (index < minVisible), user is scrolling down
    if (leavingIndex < minVisible) {
      this.scrollDirection = 'down';
      // Add the next item after current maximum
      newIndex = maxRendered + 1;
      console.log('Scrolling DOWN: Item', leavingIndex, 'leaving top, adding', newIndex, 'at bottom');
    }
    // If item leaving from bottom (index > maxVisible), user is scrolling up
    else if (leavingIndex > maxVisible) {
      this.scrollDirection = 'up';
      // Add the previous item before current minimum
      newIndex = minRendered - 1;
      console.log('Scrolling UP: Item', leavingIndex, 'leaving bottom, adding', newIndex, 'at top');
    }

    // Check if newIndex is valid and not already rendered
    if (newIndex !== null && newIndex >= 0 && newIndex < items.length && !currentIndexes.has(newIndex)) {
      // Check if the new index is already in transition
      if (this.itemsInTransition.has(newIndex)) {
        console.log('⚠️ Target index', newIndex, 'already in transition, queuing update');
        this.pendingUpdates.set(leavingIndex, newIndex);
        return;
      }

      // Mark both indexes as in transition
      this.itemsInTransition.set(leavingIndex, true);
      this.itemsInTransition.set(newIndex, true);

      // Calculate offset for the new item
      const offset = this.calculateOffset(newIndex);

      console.log('Reusing item element:', {
        oldIndex: leavingIndex,
        newIndex,
        offset,
        direction: this.scrollDirection,
        currentRange: `${minRendered}-${maxRendered}`
      });

      // Update itemsForDraw by replacing the leaving item with the new one
      this.itemsForDraw.update(currentItems =>
        currentItems.map(item => {
          if (item.index === leavingIndex) {
            // Reuse this item's slot for the new data
            return {
              data: items[newIndex!],
              offset: offset,
              index: newIndex!
            };
          }
          return item;
        })
      );

      // Cache the new item if not already cached
      if (!this.itemsCache.has(newIndex)) {
        this.itemsCache.set(newIndex, {
          height: this.defaultItemHeight(),
          offset: offset
        });
      }

      // Clear transition flag after a short delay to allow DOM to update
      setTimeout(() => {
        this.itemsInTransition.delete(leavingIndex);
        this.itemsInTransition.delete(newIndex!);

        // Process any pending updates
        this.processPendingUpdates();
      }, 50);
    }
  }

  private processPendingUpdates(): void {
    if (this.pendingUpdates.size === 0) return;

    console.log('Processing pending updates:', this.pendingUpdates.size);

    const updates = Array.from(this.pendingUpdates.entries());
    this.pendingUpdates.clear();

    updates.forEach(([oldIndex, newIndex]) => {
      // Check if the update is still valid
      const currentItems = this.itemsForDraw();
      const currentIndexes = new Set(currentItems.map(item => item.index));

      // Only process if oldIndex is still rendered and newIndex is not
      if (currentIndexes.has(oldIndex) && !currentIndexes.has(newIndex)) {
        console.log('Processing pending update:', { oldIndex, newIndex });

        // Find the element and process the update
        const items = this.items();
        const offset = this.calculateOffset(newIndex);

        this.itemsForDraw.update(currentItems =>
          currentItems.map(item => {
            if (item.index === oldIndex) {
              return {
                data: items[newIndex],
                offset: offset,
                index: newIndex
              };
            }
            return item;
          })
        );

        if (!this.itemsCache.has(newIndex)) {
          this.itemsCache.set(newIndex, {
            height: this.defaultItemHeight(),
            offset: offset
          });
        }
      }
    });
  }

  private calculateOffset(index: number): number {
    let offset = 0;
    const defaultHeight = this.defaultItemHeight();

    for (let i = 0; i < index; i++) {
      const cachedItem = this.itemsCache.get(i);
      offset += cachedItem?.height ?? defaultHeight;
    }

    return offset;
  }

  private updateOffsetsFromIndex(startIndex: number, heightDiff: number): void {
    const items = this.items();

    for (let i = startIndex; i < items.length; i++) {
      const cachedItem = this.itemsCache.get(i);
      if (cachedItem) {
        cachedItem.offset += heightDiff;
      }
    }

    // Update currently drawn items
    this.itemsForDraw.update(currentItems =>
      currentItems.map(item => {
        if (item.index >= startIndex) {
          return { ...item, offset: item.offset + heightDiff };
        }
        return item;
      })
    );
  }

  private updateContainerHeight(): void {
    let totalHeight = 0;
    const items = this.items();
    const defaultHeight = this.defaultItemHeight();

    for (let i = 0; i < items.length; i++) {
      const cachedItem = this.itemsCache.get(i);
      totalHeight += cachedItem?.height ?? defaultHeight;
    }

    this.containerHeight.set(totalHeight);
  }

  private handleResize(entries: ResizeObserverEntry[]): void {
    const entry = entries[0];
    if (!entry) return;

    const newHeight = entry.contentRect.height;
    const oldHeight = this.scrollContainerHeight();

    if (newHeight !== oldHeight) {
      this.scrollContainerHeight.set(newHeight);
      console.log('Container resized:', { oldHeight, newHeight });

      // When container grows, we might need to add more items
      // When it shrinks, IntersectionObserver will handle removing items
      const currentItems = this.itemsForDraw();
      const defaultHeight = this.defaultItemHeight();
      const items = this.items();

      if (currentItems.length > 0 && newHeight > oldHeight) {
        const renderedIndexes = currentItems.map(item => item.index);
        const maxRendered = Math.max(...renderedIndexes);
        const itemsNeeded = Math.ceil((newHeight + defaultHeight * this.bufferSize()) / defaultHeight);
        const additionalItemsNeeded = Math.max(0, itemsNeeded - currentItems.length);

        if (additionalItemsNeeded > 0) {
          const newItems = [...currentItems];

          for (let i = 1; i <= additionalItemsNeeded; i++) {
            const newIndex = maxRendered + i;
            if (newIndex < items.length) {
              const offset = this.calculateOffset(newIndex);
              newItems.push({
                data: items[newIndex],
                offset: offset,
                index: newIndex
              });

              if (!this.itemsCache.has(newIndex)) {
                this.itemsCache.set(newIndex, {
                  height: defaultHeight,
                  offset: offset
                });
              }
            }
          }

          console.log('Added items due to resize:', additionalItemsNeeded);
          this.itemsForDraw.set(newItems);
        }
      }
    }
  }

  ngOnDestroy(): void {
    this.mutationObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.resizeObserver?.disconnect();

    // Clean up scroll subscription
    this.scrollSubscription?.unsubscribe();

    // Clear transition tracking
    this.itemsInTransition.clear();
    this.pendingUpdates.clear();
  }
}

