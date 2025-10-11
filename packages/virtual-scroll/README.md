# @vladislavburko/virtual-scroll

A high-performance virtual scroll component for Angular that uses an innovative DOM reuse strategy. Instead of destroying and recreating DOM elements, this library keeps elements in the DOM and updates their content, using CSS flex `order` property for positioning.

## ✨ Features

- **🚀 High Performance**: Handles thousands of items smoothly
- **♻️ DOM Reuse**: Elements stay in DOM, only content changes
- **📏 Dynamic Sizing**: Automatic height/width measurement with ResizeObserver
- **🔄 Dual Direction**: Supports both vertical and horizontal scrolling
- **⚡ Fixed & Dynamic Modes**: Choose between fixed or dynamic item sizes
- **🎯 Flexible Templates**: Use content projection with directives
- **🔧 Standalone**: Works with Angular standalone components
- **📦 Lightweight**: No external dependencies

## 🔧 Installation

```bash
npm install @vladislavburko/virtual-scroll
```

## 📖 Usage

### Basic Example (Vertical Scroll)

```typescript
import { Component } from '@angular/core';
import { VirtualScrollWrapperComponent } from '@vladislavburko/virtual-scroll';

@Component({
  selector: 'app-my-list',
  standalone: true,
  imports: [VirtualScrollWrapperComponent],
  template: `
    <bv-virtual-scroll-wrapper [items]="items">
      <ng-template #virtualScrollItem let-item let-index="index">
        <div class="item">
          {{ item.name }} - #{{ index }}
        </div>
      </ng-template>
    </bv-virtual-scroll-wrapper>
  `,
  styles: [`
    /* CRITICAL: Component must have height to be visible! */
    bv-virtual-scroll-wrapper {
      display: block;
      height: 500px; /* REQUIRED: Without height, nothing will show */
      width: 100%;
      border: 1px solid #ddd;
    }
  `]
})
export class MyListComponent {
  items = Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    name: \`Item \${i + 1}\`
  }));
}
```

### Horizontal Scroll

```typescript
@Component({
  template: `
    <bv-virtual-scroll-wrapper 
      [items]="items" 
      direction="horizontal">
      <ng-template #virtualScrollItem let-item>
        <div class="card">{{ item.title }}</div>
      </ng-template>
    </bv-virtual-scroll-wrapper>
  `,
  styles: [`
    bv-virtual-scroll-wrapper {
      display: block;
      height: 300px; /* Required for horizontal too! */
      width: 100%;
    }
  `]
})
export class HorizontalListComponent {
  items = [...];
}
```

### Fixed Item Size (Performance Optimization)

```typescript
@Component({
  template: `
    <bv-virtual-scroll-wrapper 
      [items]="items" 
      [itemSize]="60">
      <ng-template #virtualScrollItem let-item>
        <div class="fixed-item">{{ item.text }}</div>
      </ng-template>
    </bv-virtual-scroll-wrapper>
  `
})
export class FixedSizeListComponent {
  items = [...];
}
```

### With Header and Footer

```typescript
@Component({
  imports: [VirtualScrollWrapperComponent],
  template: `
    <bv-virtual-scroll-wrapper [items]="items">
      <ng-template #virtualScrollBefore>
        <div class="header">List Header</div>
      </ng-template>

      <ng-template #virtualScrollItem let-item>
        <div class="item">{{ item.name }}</div>
      </ng-template>

      <ng-template #virtualScrollAfter>
        <div class="footer">End of list</div>
      </ng-template>
    </bv-virtual-scroll-wrapper>
  `
})
export class ListWithHeaderFooterComponent {
  items = [...];
}
```

### Custom TrackBy Function

```typescript
@Component({
  template: `
    <bv-virtual-scroll-wrapper 
      [items]="items" 
      [trackBy]="trackByFn">
      <ng-template #virtualScrollItem let-item>
        <div>{{ item.name }}</div>
      </ng-template>
    </bv-virtual-scroll-wrapper>
  `
})
export class TrackByExampleComponent {
  items = [...];

  trackByFn(index: number, item: any): any {
    return item.id; // Use unique ID for better performance
  }
}
```

## 📋 API Reference

### VirtualScrollWrapperComponent

#### Inputs

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `items` | `T[]` | `[]` | Array of items to display |
| `direction` | `'vertical' \| 'horizontal'` | `'vertical'` | Scroll direction |
| `itemSize` | `number \| undefined` | `undefined` | Fixed item size (pixels). If not set, dynamic sizing is used |
| `bufferSize` | `number` | `5` | Number of items to render outside viewport |
| `trackBy` | `TrackByFunction<T>` | `undefined` | Custom track by function for item identity |

### Template References

The component uses template reference variables to identify different content sections.

#### Item Template (#virtualScrollItem)

Template for rendering individual items.

**Reference**: `#virtualScrollItem`

**Template Context**:
- `$implicit`: The item data
- `index`: The item's index in the array

```html
<ng-template #virtualScrollItem let-item let-index="index">
  <!-- Your item template -->
</ng-template>
```

#### Before Template (#virtualScrollBefore)

Template for content before the list (optional).

**Reference**: `#virtualScrollBefore`

```html
<ng-template #virtualScrollBefore>
  <!-- Header content -->
</ng-template>
```

#### After Template (#virtualScrollAfter)

Template for content after the list (optional).

**Reference**: `#virtualScrollAfter`

```html
<ng-template #virtualScrollAfter>
  <!-- Footer content -->
</ng-template>
```

## 🎨 Styling

The component provides these CSS classes for styling:

- `.virtual-scroll-container` - The scrollable container
- `.virtual-scroll-content` - The content wrapper
- `.virtual-item` - Individual item wrapper
- `.virtual-scroll-before` - Before content wrapper
- `.virtual-scroll-after` - After content wrapper

### Example Custom Styles

```css
/* IMPORTANT: Always set a height on the wrapper! */
bv-virtual-scroll-wrapper {
  display: block;
  height: 500px; /* Required! Set desired height */
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 8px;
}

::ng-deep .virtual-item {
  padding: 1rem;
  border-bottom: 1px solid #eee;
}
```

## 🏗️ How It Works

This library uses an innovative approach to virtual scrolling:

1. **DOM Element Pool**: Instead of creating/destroying elements, a fixed pool of DOM elements is maintained
2. **Content Updates**: As you scroll, visible elements get their content updated with new data
3. **Absolute Positioning with Transform**: Items are positioned using `position: absolute` with `transform: translate()` for optimal performance
4. **Scroll Area Container**: The content container's height/width defines the total scrollable area
5. **Size Tracking**: ResizeObserver measures each item's size for accurate scroll calculations
6. **Performance**: This approach reduces memory allocation and garbage collection overhead

### Performance Benefits

- ✅ Reduced DOM manipulations
- ✅ Lower memory usage
- ✅ Fewer garbage collection cycles
- ✅ Smoother animations and transitions
- ✅ Better performance on mobile devices
- ✅ No scroll jumping due to proper absolute positioning and scroll container sizing

## 🔄 Dynamic vs Fixed Size Mode

### Dynamic Size Mode (Default)

When `itemSize` is not provided, the component automatically measures each item's size using ResizeObserver. This is ideal for:

- Lists with varying item heights
- Content that changes dynamically
- Responsive layouts

### Fixed Size Mode

When `itemSize` is provided, all items are assumed to have the same size. This provides better performance for:

- Uniform lists (all items same height)
- Large datasets where measurement overhead matters
- Simple, consistent layouts

## 📊 Performance Tips

1. **Use TrackBy**: Always provide a `trackBy` function for better change detection
2. **Fixed Size When Possible**: Use `itemSize` if all items are the same size
3. **Optimize Templates**: Keep item templates simple and avoid heavy computations
4. **Buffer Size**: Adjust `bufferSize` based on your item size and scroll speed
5. **CSS Containment**: The component uses CSS `contain` for optimal rendering

## 🐛 Troubleshooting

### Items not showing / Component not visible?

**This is the #1 issue!** The component MUST have an explicit height set.

```css
/* ✅ CORRECT - Component will be visible */
bv-virtual-scroll-wrapper {
  display: block;
  height: 500px; /* REQUIRED! */
  width: 100%;
}

/* ❌ WRONG - Component won't show */
bv-virtual-scroll-wrapper {
  display: block;
  /* Missing height! */
}
```

**Why?** The component uses absolute positioning internally, which requires a defined container height.

### Performance issues?

1. Use `trackBy` function
2. Use fixed `itemSize` if all items are the same height
3. Reduce `bufferSize` if rendering too many items

### Items jumping around?

This happens when using dynamic sizing. The component measures items after they render. Consider using `itemSize` for fixed heights.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details

## 🐛 Issues

Found a bug? Please [open an issue](https://github.com/vladislavburko/virtual-scroll/issues).

## 📚 Related

- [Angular Virtual Scroll](https://material.angular.io/cdk/scrolling/overview)
- [CSS Containment](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Containment)
- [ResizeObserver API](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)

## 🎯 Roadmap

- [ ] Support for grid layouts
- [ ] Sticky headers/footers
- [ ] Infinite scroll integration
- [ ] Performance monitoring tools
- [ ] More examples and demos

---

Made with ❤️ by Vladislav Burko

