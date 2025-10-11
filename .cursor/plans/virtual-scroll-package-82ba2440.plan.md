<!-- 82ba2440-e7bd-455a-8c80-da5c8ed1d676 248c70ba-66bc-4755-9173-7143a439fbcd -->
# Fix DOM Node Recreation - True Virtual Scrolling

## Problem

Currently, `virtualItems` creates/destroys DOM nodes on every scroll because the array changes:

- `@for` loop creates new elements for new indices
- DOM nodes are recreated instead of reused
- Performance impact from constant DOM manipulation

## Solution

Create a **fixed pool** of DOM elements that:

1. Is initialized once based on viewport + buffer size
2. Never changes in count (unless items input changes)
3. Only updates content and position properties
4. Truly reuses the same DOM nodes

## Implementation Steps

### 1. Add Pool Size Calculation

**File**: `virtual-scroll-wrapper.component.ts`

Add computed for pool size:

```typescript
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
```

### 2. Initialize Fixed Pool

**File**: `virtual-scroll-wrapper.component.ts`

Change `virtualItems` initialization in `ngAfterContentInit` or effect:

```typescript
effect(() => {
  const items = this.items();
  const pool = this.poolSize();
  
  if (items.length === 0) {
    this.virtualItems.set([]);
    return;
  }
  
  // Create fixed pool only if it doesn't exist or size changed
  const current = this.virtualItems();
  if (current.length !== Math.min(pool, items.length)) {
    this.initializePool();
  }
}, { allowSignalWrites: true });
```

### 3. Create `initializePool()` Method

```typescript
private initializePool(): void {
  const items = this.items();
  const pool = Math.min(this.poolSize(), items.length);
  
  // Create fixed array of virtual items
  const fixedPool: VirtualItem<T>[] = [];
  for (let i = 0; i < pool; i++) {
    fixedPool.push({
      data: items[i],
      index: i,
      offset: 0,
      poolIndex: i // Add stable pool index for tracking
    });
  }
  
  this.virtualItems.set(fixedPool);
}
```

### 4. Update `VirtualItem` Interface

Add `poolIndex` for stable tracking:

```typescript
interface VirtualItem<T> {
  data: T;
  index: number;      // Data index (changes on scroll)
  offset: number;
  poolIndex: number;  // Pool index (never changes)
}
```

### 5. Refactor `recalculate()` to Update Pool

Instead of creating new array, update existing items:

```typescript
private recalculate(): void {
  const items = this.items();
  if (!items || items.length === 0) {
    this.virtualItems.set([]);
    return;
  }

  const viewport = this.viewportSize();
  const scroll = this.scrollOffset();
  const measurements = this.calculateMeasurements();

  // Find visible range
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
    const updatedPool = [...pool]; // Create shallow copy for change detection
    
    for (let poolIdx = 0; poolIdx < pool.length; poolIdx++) {
      const dataIdx = bufferedStart + poolIdx;
      
      if (dataIdx <= bufferedEnd) {
        updatedPool[poolIdx] = {
          ...pool[poolIdx],
          data: items[dataIdx],
          index: dataIdx,
          offset: measurements[dataIdx].offset
        };
      }
    }
    
    return updatedPool;
  });
}
```

### 6. Update Template Tracking

**File**: `virtual-scroll-wrapper.component.html`

Change `@for` to track by `poolIndex` (stable):

```html
@for (item of virtualItems(); track item.poolIndex) {
  <div
    class="virtual-item"
    [attr.data-index]="item.index"
    [style.transform]="isVertical() ? 'translateY(' + item.offset + 'px)' : 'translateX(' + item.offset + 'px)'"
  >
    @if (itemTemplate()) {
      <ng-container *ngTemplateOutlet="itemTemplate() ?? null; context: getItemContext(item)"></ng-container>
    }
  </div>
}
```

### 7. Update `trackByIndex` Method

```typescript
trackByPoolIndex(index: number, item: VirtualItem<T>): number {
  return item.poolIndex; // Track by stable pool index, not data index
}
```

## Expected Behavior

✅ **Fixed pool size** - DOM nodes count stays constant

✅ **No recreation** - Same DOM nodes reused

✅ **Content updates** - Only data, index, offset change

✅ **Better performance** - No DOM creation/destruction

✅ **Stable tracking** - `poolIndex` never changes

## Benefits

- True DOM reuse (original requirement)
- Better performance (no DOM manipulation)
- Smoother scrolling
- Lower memory usage
- Fewer garbage collections

### To-dos

- [ ] Set up library package structure and build configuration
- [ ] Create template marking directives (item, before, after)
- [ ] Create VirtualScrollWrapperComponent with inputs and template structure
- [ ] Implement ResizeObserver-based item size tracking
- [ ] Create DOM element pool management system
- [ ] Implement scroll event handling and visible range calculation
- [ ] Implement DOM element content and order updates
- [ ] Add horizontal/vertical direction support
- [ ] Build comprehensive demo application with examples
- [ ] Create documentation and prepare for npm publishing