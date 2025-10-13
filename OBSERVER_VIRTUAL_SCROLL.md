# Observer-Based Virtual Scroll Implementation

## Overview

This is a modern virtual scroll implementation that uses **browser observers** instead of scroll event listeners. It provides excellent performance and smooth scrolling for large lists.

## Architecture

### Core Components

1. **ObserverVirtualScrollComponent** (`observer-virtual-scroll.component.ts`)
   - Generic reusable virtual scroll component
   - Uses three types of observers
   - Supports dynamic item heights

2. **ObserverDemoComponent** (`observer-demo.component.ts`)
   - Demo showcase with configurable item counts
   - Beautiful UI with controls
   - Example usage of the virtual scroll component

## How It Works

### Data Structures

#### 1. Items (Input)
The original data array passed from the parent component.

#### 2. Items For Draw (Virtual Array)
Contains only the items currently rendered in the DOM:
```typescript
interface VirtualItem<T> {
  data: T;        // Original item data
  offset: number; // Y-position in pixels
  index: number;  // Index in original array
}
```

#### 3. Items Cache
A Map storing dimensions and offsets for all items:
```typescript
interface CacheItem {
  height: number; // Actual measured height
  offset: number; // Y-position from top
}
```

#### 4. Container Height
Calculated as `items.length * defaultItemHeight` initially, then updated dynamically as actual heights are measured.

### Initialization Phase

1. **Wait for Container**: Use `effect()` to wait for view children (scroll container and items container)

2. **Calculate Initial Items**: Determine how many items needed to fill viewport + buffer:
   ```
   itemsNeeded = ceil((viewportHeight + buffer * defaultHeight) / defaultHeight)
   ```

3. **Setup Observers**: Initialize all three observers

4. **Render Initial Items**: Create and render the calculated number of items

### Observer System

#### 1. MutationObserver
**Purpose**: Track when DOM nodes are added/removed

**Responsibilities**:
- Measure actual height of newly added items
- Update cache with real dimensions
- Adjust offsets of subsequent items if height differs from default
- Observe new items with IntersectionObserver
- Clean up IntersectionObserver for removed items

```typescript
mutationObserver.observe(itemsContainer, {
  childList: true,
  subtree: false
});
```

#### 2. IntersectionObserver
**Purpose**: Track which items are visible/entering/leaving viewport

**Responsibilities**:
- Detect which items are currently visible
- Determine scroll direction (up/down)
- Trigger updates to add/remove items based on visibility
- Use rootMargin for buffer zones

```typescript
intersectionObserver = new IntersectionObserver(
  (entries) => handleIntersections(entries),
  {
    root: scrollContainer,
    rootMargin: `${defaultHeight * bufferSize}px`,
    threshold: [0, 0.1, 0.9, 1]
  }
);
```

**Scroll Direction Detection**:
- Track minimum visible index over time
- If min increases → scrolling down
- If min decreases → scrolling up

#### 3. ResizeObserver
**Purpose**: Handle container size changes

**Responsibilities**:
- Detect when scroll container is resized
- Recalculate how many items should be visible
- Update rendered items to fill/free space

```typescript
resizeObserver.observe(scrollContainer);
```

### Virtual Scrolling Logic

#### Adding Items (Scrolling Down)
1. IntersectionObserver detects items entering bottom buffer
2. Calculate new range: `[currentMin - buffer, currentMax + buffer]`
3. Render additional items below
4. MutationObserver measures new items
5. Update cache and offsets

#### Removing Items (Scrolling)
1. Items leave buffer zone
2. IntersectionObserver detects they're no longer visible
3. Calculate new range excluding off-screen items
4. Update `itemsForDraw` signal to remove them
5. DOM automatically updates (Angular's `@for`)

#### Height Adjustment
1. Item rendered with default height
2. MutationObserver fires when item added to DOM
3. Measure actual `offsetHeight`
4. If different from default:
   - Update cache for this item
   - Calculate height difference
   - Adjust offsets for all subsequent items
   - Update container height
   - Update transforms for currently rendered items

### Positioning System

All items use `position: absolute` with `transform: translateY()`:

```css
.virtual-item {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  transform: translateY(123px); /* offset */
  will-change: transform;
  contain: layout style paint;
}
```

**Benefits**:
- GPU-accelerated rendering
- Smooth animations
- Better performance than top/left positioning

## Key Features

### ✅ No Scroll Event Listeners
Uses observers instead of listening to scroll events → better performance

### ✅ Dynamic Heights
Each item can have different height, measured automatically

### ✅ Efficient Caching
Heights and offsets cached to avoid recalculation

### ✅ Smart Buffer
Renders extra items above/below viewport for smooth scrolling

### ✅ Responsive
Adapts when container is resized

### ✅ Generic & Reusable
Works with any data type using TypeScript generics

### ✅ Memory Efficient
Only renders visible items + buffer (typically ~20 items for viewport of thousands)

## Usage Example

```typescript
@Component({
  selector: 'app-my-component',
  template: `
    <app-observer-virtual-scroll
      [items]="myItems()"
      [defaultItemHeight]="100"
      [bufferSize]="5"
      [itemTemplate]="itemTpl()"
    />

    <ng-template #itemTpl let-item let-index="index">
      <div class="my-item">
        <h3>{{ item.title }}</h3>
        <p>{{ item.description }}</p>
      </div>
    </ng-template>
  `
})
export class MyComponent {
  myItems = signal([...]);
  itemTpl = viewChild<TemplateRef<any>>('itemTpl');
}
```

## API

### Inputs

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `items` | `T[]` | required | Array of data to display |
| `defaultItemHeight` | `number` | `50` | Initial height estimate (px) |
| `bufferSize` | `number` | `3` | Extra items to render above/below |
| `itemTemplate` | `TemplateRef` | required | Template for rendering each item |

### Template Context

The item template receives:
- `$implicit`: The item data
- `index`: Index in the original array

## Performance Characteristics

| Item Count | Rendered Items | Memory Usage |
|------------|---------------|--------------|
| 100 | ~15 | Low |
| 1,000 | ~15 | Low |
| 10,000 | ~15 | Low |
| 100,000 | ~15 | Low |

**Key Point**: Number of rendered items stays constant regardless of total item count!

## Browser Support

Requires:
- ✅ MutationObserver (all modern browsers)
- ✅ IntersectionObserver (all modern browsers)
- ✅ ResizeObserver (all modern browsers, IE not supported)

## Advantages Over Scroll-Based Approach

1. **Better Performance**: No scroll throttling/debouncing needed
2. **More Precise**: IntersectionObserver gives exact visibility information
3. **Cleaner Code**: Declarative observer patterns vs imperative scroll handling
4. **Battery Friendly**: Observers are more efficient than scroll listeners
5. **Natural API**: Browser-native APIs designed for these use cases

## Running the Demo

```bash
npm start
```

Navigate to: `http://localhost:4200/observer-demo`

Try:
- Scrolling through thousands of items
- Changing item count with buttons
- Resizing the browser window
- Inspecting DOM to see only ~15 items rendered

## Files

- `src/app/observer-virtual-scroll.component.ts` - Main virtual scroll component
- `src/app/observer-demo.component.ts` - Demo showcase
- `src/app/app.routes.ts` - Route configuration

