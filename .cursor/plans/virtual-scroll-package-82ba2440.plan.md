<!-- 82ba2440-e7bd-455a-8c80-da5c8ed1d676 0550bb6e-3e7c-4d43-a42e-6e93734eaa65 -->
# Optimize Offset Recalculation Performance

## Overview

Refactor the resize and recalculation logic to:
1. Separate concerns (measurement, positioning, rendering)
2. Batch resize events before recalculation
3. Only recalculate downstream items from resized element
4. Keep incremental offset updates in ResizeObserver

## Current Problems

- Every resize triggers full `recalculate()` and `updateTotalSize()`
- No batching of multiple resize events
- Offset calculation mixed between ResizeObserver and `calculateMeasurements()`
- Full array iteration even when only one item resized

## Implementation Steps

### 1. Add Batching Infrastructure

**File**: `packages/virtual-scroll/src/lib/virtual-scroll-wrapper.component.ts`

Add batching properties:

```typescript
// After other private properties
private resizeBatch = new Map<number, number>(); // index → new size
private resizeBatchTimeout?: any;
private minAffectedIndex: number = Infinity;
```

### 2. Refactor ResizeObserver to Batch Updates

**File**: `packages/virtual-scroll/src/lib/virtual-scroll-wrapper.component.ts`

In `setupResizeObserver()`, replace the current resize handling logic:

```typescript
// Current: processes each resize immediately
if (indexStr !== null) {
  const index = parseInt(indexStr, 10);
  const size = this.direction() === 'vertical' ? entry.contentRect.height : entry.contentRect.width;
  
  const cachedData = this.itemSizeCache.get(index);
  const cachedSize = cachedData?.size;
  
  if (size > 0 && (cachedSize === undefined || Math.abs(cachedSize - size) > 0.5)) {
    // Add to batch instead of processing immediately
    this.resizeBatch.set(index, size);
    this.minAffectedIndex = Math.min(this.minAffectedIndex, index);
    
    // Schedule batch processing
    this.scheduleBatchedRecalculation();
  }
}
```

### 3. Create Batch Processing Method

**File**: `packages/virtual-scroll/src/lib/virtual-scroll-wrapper.component.ts`

Add new method after `setupResizeObserver()`:

```typescript
/**
 * Schedule batched recalculation (debounced)
 */
private scheduleBatchedRecalculation(): void {
  if (this.resizeBatchTimeout) {
    clearTimeout(this.resizeBatchTimeout);
  }
  
  this.resizeBatchTimeout = setTimeout(() => {
    this.processBatchedResizes();
  }, 16); // ~60fps, batch multiple resizes in same frame
}

/**
 * Process all batched resize events at once
 */
private processBatchedResizes(): void {
  if (this.resizeBatch.size === 0) return;
  
  let totalSizeAdjustment = 0;
  
  // Update cache and calculate size differences
  for (const [index, newSize] of this.resizeBatch) {
    const cachedData = this.itemSizeCache.get(index);
    const oldSize = cachedData?.size ?? this.defaultItemSize;
    const sizeDifference = newSize - oldSize;
    
    // Update cache with new size (offset will be recalculated below)
    this.itemSizeCache.set(index, {
      size: newSize,
      offset: cachedData?.offset ?? 0
    });
    
    totalSizeAdjustment += sizeDifference;
  }
  
  // Adjust total size incrementally
  if (totalSizeAdjustment !== 0) {
    this.totalSize.update(current => current + totalSizeAdjustment);
  }
  
  // Recalculate offsets only for affected items (from minAffectedIndex onwards)
  this.recalculateOffsetsFrom(this.minAffectedIndex);
  
  // Update visible items positions
  this.updateVisibleItemPositions();
  
  // Clear batch
  this.resizeBatch.clear();
  this.minAffectedIndex = Infinity;
  
  this.cdr.markForCheck();
}
```

### 4. Create Incremental Offset Recalculation

**File**: `packages/virtual-scroll/src/lib/virtual-scroll-wrapper.component.ts`

Add new method for incremental offset updates:

```typescript
/**
 * Recalculate offsets only from a specific index onwards
 * More performant than full recalculation
 */
private recalculateOffsetsFrom(startIndex: number): void {
  const items = this.items();
  if (startIndex >= items.length) return;
  
  // Get the offset to start from
  let currentOffset: number;
  
  if (startIndex === 0) {
    // First item starts after before content
    currentOffset = this.beforeContentSize();
  } else {
    // Start from previous item's end
    const prevCache = this.itemSizeCache.get(startIndex - 1);
    if (!prevCache) return; // Can't calculate without previous item
    currentOffset = prevCache.offset + prevCache.size;
  }
  
  // Update offsets for all subsequent items
  for (let i = startIndex; i < items.length; i++) {
    const cachedData = this.itemSizeCache.get(i);
    const size = cachedData?.size ?? this.defaultItemSize;
    
    // Update cache with new offset
    this.itemSizeCache.set(i, { size, offset: currentOffset });
    
    currentOffset += size;
  }
}
```

### 5. Separate Visible Item Position Updates

**File**: `packages/virtual-scroll/src/lib/virtual-scroll-wrapper.component.ts`

Extract position update logic from `recalculate()`:

```typescript
/**
 * Update only the positions of currently visible pool items
 * Called after offset cache is updated
 */
private updateVisibleItemPositions(): void {
  const items = this.items();
  if (!items || items.length === 0) return;
  
  const pool = this.virtualItems();
  if (pool.length === 0) return;
  
  // Update positions of pool items based on current cache
  this.virtualItems.update(currentPool => {
    return currentPool.map((poolItem) => {
      if (poolItem.index >= 0 && poolItem.index < items.length) {
        const cachedData = this.itemSizeCache.get(poolItem.index);
        if (cachedData) {
          return {
            ...poolItem,
            offset: cachedData.offset
          };
        }
      }
      return poolItem;
    });
  });
}
```

### 6. Refactor Main `recalculate()` Method

**File**: `packages/virtual-scroll/src/lib/virtual-scroll-wrapper.component.ts`

Simplify `recalculate()` to focus on visible range calculation:

```typescript
private recalculate(): void {
  const items = this.items();
  if (!items || items.length === 0) {
    this.virtualItems.set([]);
    this.totalSize.set(0);
    return;
  }

  const pool = this.virtualItems();
  if (pool.length === 0) return;

  const viewport = this.viewportSize();
  const scroll = this.scrollOffset();

  // Get measurements (reads from cache, doesn't recalculate)
  const measurements = this.getMeasurementsFromCache();

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

  // Update pool items with new data indices and offsets
  this.virtualItems.update(pool => {
    return pool.map((_, poolIndex) => {
      const dataIdx = bufferedStart + poolIndex;
      const isVisible = dataIdx <= bufferedEnd && dataIdx < items.length;
      const index = isVisible ? dataIdx : -999999999;
      const cachedData = this.itemSizeCache.get(dataIdx);
      const offset = isVisible && cachedData ? cachedData.offset : -999999999;
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
```

### 7. Add Cache Reading Method

**File**: `packages/virtual-scroll/src/lib/virtual-scroll-wrapper.component.ts`

Add helper to read measurements from cache without recalculation:

```typescript
/**
 * Get measurements from cache (read-only, no recalculation)
 */
private getMeasurementsFromCache(): ItemMeasurement[] {
  const items = this.items();
  const measurements: ItemMeasurement[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const cached = this.itemSizeCache.get(i);
    measurements.push({
      size: cached?.size ?? this.defaultItemSize,
      offset: cached?.offset ?? 0
    });
  }
  
  return measurements;
}
```

### 8. Remove Old `calculateMeasurements()` Method

**File**: `packages/virtual-scroll/src/lib/virtual-scroll-wrapper.component.ts`

Delete the current `calculateMeasurements()` method as it's replaced by:
- `recalculateOffsetsFrom()` for offset updates
- `getMeasurementsFromCache()` for reading

### 9. Update Cleanup

**File**: `packages/virtual-scroll/src/lib/virtual-scroll-wrapper.component.ts`

Add cleanup for batch timeout:

```typescript
ngOnDestroy(): void {
  if (this.resizeObserver) {
    this.resizeObserver.disconnect();
  }
  if (this.mutationObserver) {
    this.mutationObserver.disconnect();
  }
  if (this.scrollSubscription) {
    this.scrollSubscription.unsubscribe();
  }
  // Add batch timeout cleanup
  if (this.resizeBatchTimeout) {
    clearTimeout(this.resizeBatchTimeout);
  }
}
```

## Expected Improvements

**Performance:**
- 10 rapid resizes → 1 recalculation (batching)
- Only recalculate downstream items, not entire list
- Cache reads instead of recalculations during scroll

**Code Organization:**
- Clear separation: measurement (ResizeObserver) vs. positioning (recalculateOffsetsFrom) vs. rendering (recalculate)
- Incremental updates instead of full recalculations
- Predictable data flow: Resize → Batch → Update Cache → Update Offsets → Update Positions

**Declarative:**
- Each method has single responsibility
- Data flows one direction: Input → Process → Output
- No mixed concerns between observers and calculations


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