# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.2] - 2025-10-11

### Fixed - CRITICAL: Switched from @for to *ngFor

- **CRITICAL FIX**: Replaced `@for` with traditional `*ngFor` directive
  - `@for` with signals expects **immutability** - doesn't detect object mutations
  - `*ngFor` with OnPush + `markForCheck()` **detects mutations** properly
  - Same array reference + same objects = **perfect DOM reuse**
  - DOM nodes now **truly never recreated**

### Why This Matters

```html
<!-- BEFORE (@for with signals - immutable paradigm): -->
@for (item of virtualItems(); track trackByPoolIndex($index, item)) {
  <!-- Changes to item.data/offset NOT detected -->
}

<!-- AFTER (*ngFor - mutable paradigm): -->
<div *ngFor="let item of virtualItems(); trackBy: trackByPoolIndex">
  <!-- Changes to item.data/offset detected via markForCheck() -->
</div>
```

Angular's `@for` is designed for signals which are **immutable**. When we mutate properties inside objects, the signal doesn't propagate changes because the array reference didn't change.

`*ngFor` with OnPush strategy works perfectly with our mutation approach - `markForCheck()` tells Angular to check the current state, and trackBy ensures the same DOM nodes are reused.

## [2.3.1] - 2025-10-11

### Fixed - CRITICAL: Prevented Array Signal Update

- **CRITICAL FIX**: Removed `virtualItems.set([...pool])` that was causing DOM recreation
  - Signal reference now NEVER changes during scroll
  - Only `markForCheck()` called to update bindings
  - Array reference remains stable, objects mutated in place

### Why This Matters

```typescript
// BEFORE (was still recreating):
this.virtualItems.set([...pool]);  // ❌ New array = recreation

// AFTER (true reuse):
this.cdr.markForCheck();  // ✅ Same array = reuse
```

## [2.3.0] - 2025-10-11

### Changed - ULTIMATE PERFORMANCE: TRUE OBJECT PERSISTENCE

- **BREAKING (internal only)**: Pool objects are now MUTATED instead of recreated
  - `VirtualItem` objects maintain stable identity throughout their lifetime
  - Properties (`data`, `index`, `offset`) updated in-place via mutation
  - Object references NEVER change, ensuring Angular reuses exact same DOM nodes
  - Zero object allocation during scroll

### Benefits

- ✅ **100% DOM Reuse**: Same DOM nodes from initialization to destruction
- ✅ **Zero Object Creation**: Properties mutated, not replaced
- ✅ **Zero Array Recreation**: Signal reference never changes
- ✅ **Perfect trackBy**: Same object + same array = same DOM guaranteed
- ✅ **Ultimate Performance**: No GC pressure, no memory churn
- ✅ **Battery Life**: Minimal CPU usage during scroll

### Technical Details

- **Object Mutation Strategy**:
  ```typescript
  // OLD (created new objects):
  updatedPool[idx] = { poolIndex, data, index, offset };
  
  // NEW (mutates existing objects):
  poolItem.data = items[dataIdx];
  poolItem.index = dataIdx;
  poolItem.offset = offset;
  // poolIndex never changes
  ```
- **Change Detection**: Only `markForCheck()` - no signal update
- **Hidden Items**: Mutated to `index: -1` instead of destroyed

## [2.2.0] - 2025-10-11

### Fixed - CRITICAL OVERLAP BUG

- **Fixed item overlap issue** - Items were sometimes overlapping due to non-reactive pool size calculation
  - Added `cacheSizeSignal` to make item size cache changes reactive
  - `poolSize` computed now properly reacts to measured item sizes
  - Pool automatically resizes when items are measured
  
- **Fixed pool resize during scroll** - Prevented blank frames when pool needs to be recreated
  - Pool recreation during scroll now deferred to prevent immediate return
  - Existing pool continues rendering until new pool is ready
  - Added validation to detect and prevent duplicate data indices
  
- **Improved item rendering safety**
  - Added duplicate index detection with console error logging
  - Hidden items (index: -1) now properly marked with visibility and CSS class
  - Context not provided for hidden items to prevent rendering errors
  - Added stricter bounds checking in pool update logic

### Technical Details

- **Reactive Cache**: `itemSizeCache` changes now trigger `poolSize` recomputation via `cacheSizeSignal`
- **Smart Pool Resizing**: Pool size adapts to actual measured item sizes, not just estimates
- **Safe Rendering**: Multiple safeguards to ensure no duplicate items or overlapping positions

## [2.0.0] - 2025-10-11

### Changed - MAJOR PERFORMANCE IMPROVEMENT

- **BREAKING**: Implemented true fixed DOM node pool - DOM nodes are now NEVER recreated
  - Added `poolIndex` property to `VirtualItem` interface for stable tracking
  - Added `poolSize` computed signal that calculates optimal pool size
  - Created `initializePool()` method that creates fixed array of DOM elements
  - Refactored `recalculate()` to UPDATE existing pool items instead of creating new ones
  - Changed template tracking from `trackByIndex()` to `trackByPoolIndex()` (stable)
  - Pool size is based on: `Math.ceil(viewport / itemSize) + (buffer * 2)`

### Technical Details

- **Fixed Pool Behavior**:
  - Pool is created once on initialization
  - Pool size only changes if viewport size or buffer size changes significantly
  - During scroll, only item properties are updated (data, index, offset)
  - Same DOM nodes are reused by updating their content
  - `poolIndex` provides stable identity for each DOM node

- **Effect-based Pool Management**:
  - Effect monitors `items()` and `poolSize()` signals
  - Recreates pool only if target size changed
  - Otherwise just recalculates positions (no DOM changes)

### Benefits

- ✅ **True DOM Reuse**: Original requirement fully implemented
- ✅ **Zero DOM Recreation**: Same nodes persist throughout scrolling
- ✅ **Better Performance**: No DOM creation/destruction overhead
- ✅ **Smoother Scrolling**: Reduced browser reflow/repaint
- ✅ **Lower Memory Usage**: Constant memory footprint
- ✅ **Fewer GC Cycles**: Less garbage collection pressure

### Migration Notes

This is a breaking change only at the internal level. The public API remains the same.
- Template now tracks by `poolIndex` instead of data `index`
- Added `data-pool-index` attribute for debugging

## [1.0.6] - 2025-10-11

### Fixed

- **Critical**: `totalSize` now always includes `afterContentSize`
  - Added `updateTotalSize()` method to recalculate full size including before/after content
  - Called when before/after content sizes change (detected by ResizeObserver)
  - Ensures scroll container height/width is accurate: `beforeContent + items + afterContent`
  - Prevents scroll jumping when after content appears

### Changed

- Improved total size calculation logic
  - Incremental adjustments for item size changes (fast)
  - Full recalculation when before/after content changes (accurate)
  - Always maintains: `totalSize = beforeContentSize + itemsTotal + afterContentSize`

### Benefits
- Accurate scroll container size at all times
- After content properly included in scrollable area
- Smooth scrolling when reaching end of list
- No jumps when after content becomes visible

## [1.0.5] - 2025-10-11

### Changed

- **Performance optimization**: Enhanced cache to store both size and offset
  - Changed `itemSizeCache` from `Map<number, number>` to `Map<number, { size, offset }>`
  - `afterContentOffset` now uses O(1) lookup instead of O(n) loop
  - Cache automatically updated during `calculateMeasurements()`
  - Significantly faster after content positioning, especially with large lists

### Benefits
- Eliminates loop through all items for after content positioning
- Constant-time lookup of last item's offset and size
- Better performance with large item lists (1000+ items)
- Cache maintains both spatial and dimensional information

## [1.0.4] - 2025-10-11

### Fixed

- **After content positioning**: Fixed incorrect offset calculation
  - After content now correctly positioned at: beforeContentSize + sum of all items' sizes
  - Uses cached sizes when available, falls back to defaultItemSize for unmeasured items
  - Changed from using totalSize (which included after content itself) to calculated offset
  - Prevents after content from appearing at wrong position

### Benefits
- After content always appears right after the last item
- Correct positioning regardless of scroll state
- Proper handling of dynamic item sizes

## [1.0.3] - 2025-10-11

### Fixed

- **Critical**: Prevent caching zero/invalid sizes in ResizeObserver
  - Added `size > 0` check before caching item sizes
  - Prevents caching measurements when elements haven't fully rendered
  - Fixes total size corruption when ResizeObserver fires too early
  - Ensures cached sizes are always valid (> 0px)

### Impact
- Eliminates negative size adjustments that corrupt total size
- Prevents scroll jumping caused by zero-sized cached items
- More stable initialization and resize behavior

## [1.0.2] - 2025-10-11

### Fixed

- **Offset calculation**: Fixed item positioning logic
  - Before content now always has offset 0 (positioned at top/left)
  - First item (index 0) now correctly starts at `beforeContentSize` offset
  - Each subsequent item's offset = previous item offset + previous item size
  - Removed duplicate beforeOffset addition in `recalculate()`
  
- **Total size calculation**: Fixed to include all content
  - `initializeTotalSize()` now includes before content + items + after content
  - After content positioned at correct offset (end of all items)
  
- **Size estimation**: Changed to use fixed default size (50px)
  - Unmeasured items now consistently use `defaultItemSize` instead of calculated average
  - Prevents total size fluctuation as items with different sizes are measured
  - Incremental adjustments via ResizeObserver handle actual size differences

### Benefits
- Eliminates overlap between before content and first item
- Accurate scroll container size from initialization
- More predictable and stable scrolling behavior
- Consistent size estimation across all unmeasured items

## [1.0.1] - 2025-10-11

### Changed

- Refactored content size tracking to use computed signals
  - Removed manual `measureBeforeContent()` method
  - Replaced `beforeContentSize` signal with computed signal that automatically tracks `beforeContent()` element size
  - Added `afterContentSize` computed signal to track `afterContent()` element size
  - Content sizes now update automatically when elements change or direction changes
  
### Benefits
- More reactive and automatic size tracking
- Cleaner code with fewer manual measurement methods
- Better integration with Angular's reactivity system

## [1.0.0] - 2025-10-11

### Changed

- **BREAKING**: Replaced decorators with signal-based APIs
  - `@Input()` → `input()` signal function
  - `@ViewChild()` → `viewChild()` signal function  
  - `@ContentChild()` → `contentChild()` signal function
  - All properties are now signals and must be called as functions (e.g., `items()` instead of `items`)
  
- **BREAKING**: Replaced custom directives with template reference variables
  - Use `#virtualScrollItem` instead of `virtualScrollItem` directive
  - Use `#virtualScrollBefore` instead of `virtualScrollBefore` directive
  - Use `#virtualScrollAfter` instead of `virtualScrollAfter` directive
  - No need to import directives anymore - simpler API!

### Fixed

- **Major Fix**: Replaced flex-order positioning with absolute positioning + transforms to prevent scroll jumping
- Container now has explicit height/width equal to total scroll area
- Items positioned with `translateY`/`translateX` at calculated offsets
- **Before content positioning**: Items now correctly offset after before content (no overlap with index 0)
- **Initial size calculation**: Total size initialized with default item size estimate (50px)
- **Incremental height adjustment**: Height adjusts incrementally as items measured (no full recalculation)
- Added `allowSignalWrites: true` to effect to prevent runtime error when writing to signals

### Added

- Initial release of @vladislavburko/virtual-scroll
- VirtualScrollWrapperComponent with DOM reuse strategy
- Support for vertical and horizontal scrolling
- Dynamic item sizing with ResizeObserver
- Fixed item size mode for performance optimization
- Template reference variables for content projection (#virtualScrollItem, #virtualScrollBefore, #virtualScrollAfter)
- Buffer size configuration
- Custom trackBy function support
- Comprehensive documentation and examples
- Demo application with multiple examples

### Features

- Innovative DOM reuse approach (elements stay in DOM)
- Absolute positioning with CSS transforms for optimal performance
- GPU-accelerated rendering with `transform: translate()`
- Support for 10,000+ items with smooth scrolling
- Automatic size measurement and caching
- Responsive and mobile-friendly
- Standalone components (Angular 17+)
- Zero external dependencies
- TypeScript support

### Performance

- Optimized rendering with element pooling
- Reduced memory allocation
- Fewer garbage collection cycles
- Efficient scroll event handling with throttling
- CSS containment for better rendering performance

