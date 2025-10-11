# Quick Start Guide

Get started with the Virtual Scroll package in 5 minutes!

## 📦 Installation

```bash
npm install @vladislavburko/virtual-scroll
```

## 🚀 Basic Usage

### Step 1: Import the Component

```typescript
import { Component } from '@angular/core';
import { VirtualScrollWrapperComponent } from '@vladislavburko/virtual-scroll';

@Component({
  selector: 'app-my-list',
  standalone: true,
  imports: [VirtualScrollWrapperComponent],
  template: `
    <!-- Your template here -->
  `
})
export class MyListComponent {
  // Your component code
}
```

### Step 2: Add Your Data

```typescript
export class MyListComponent {
  items = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `Item ${i + 1}`,
    description: `This is item number ${i + 1}`
  }));
}
```

### Step 3: Create the Template

```html
<bv-virtual-scroll-wrapper [items]="items">
  <ng-template #virtualScrollItem let-item let-index="index">
    <div class="item">
      <h3>{{ item.name }}</h3>
      <p>{{ item.description }}</p>
      <small>Index: {{ index }}</small>
    </div>
  </ng-template>
</bv-virtual-scroll-wrapper>
```

### Step 4: Add Styling (REQUIRED!)

```css
/* IMPORTANT: Set height for the container to be visible! */
bv-virtual-scroll-wrapper {
  display: block;
  height: 500px; /* Required! Without this, component won't be visible */
  border: 1px solid #ddd;
  border-radius: 8px;
}

.item {
  padding: 1rem;
  border-bottom: 1px solid #eee;
}

.item:hover {
  background-color: #f5f5f5;
}
```

## ✨ That's It!

You now have a working virtual scroll list! The component will automatically:
- ✅ Measure item heights
- ✅ Manage DOM elements efficiently
- ✅ Handle scrolling smoothly
- ✅ Render only visible items

## 🎯 Next Steps

### Add Header/Footer

```html
<bv-virtual-scroll-wrapper [items]="items">
  <!-- Header -->
  <ng-template #virtualScrollBefore>
    <div class="header">My List Header</div>
  </ng-template>

  <!-- Items -->
  <ng-template #virtualScrollItem let-item>
    <div>{{ item.name }}</div>
  </ng-template>

  <!-- Footer -->
  <ng-template #virtualScrollAfter>
    <div class="footer">End of list</div>
  </ng-template>
</bv-virtual-scroll-wrapper>
```

### Horizontal Scrolling

```html
<bv-virtual-scroll-wrapper 
  [items]="items" 
  direction="horizontal">
  <ng-template #virtualScrollItem let-item>
    <div class="card">{{ item.title }}</div>
  </ng-template>
</bv-virtual-scroll-wrapper>
```

### Fixed Item Size (Better Performance)

```html
<bv-virtual-scroll-wrapper 
  [items]="items" 
  [itemSize]="60">
  <ng-template #virtualScrollItem let-item>
    <div class="fixed-height-item">{{ item.name }}</div>
  </ng-template>
</bv-virtual-scroll-wrapper>
```

### Custom TrackBy (Recommended)

```typescript
export class MyListComponent {
  items = [...];

  trackByFn(index: number, item: any) {
    return item.id; // Use unique identifier
  }
}
```

```html
<bv-virtual-scroll-wrapper 
  [items]="items"
  [trackBy]="trackByFn">
  <ng-template #virtualScrollItem let-item>
    <div>{{ item.name }}</div>
  </ng-template>
</bv-virtual-scroll-wrapper>
```

## 📚 More Information

- [Full Documentation](packages/virtual-scroll/README.md)
- [API Reference](packages/virtual-scroll/README.md#api-reference)
- [Demo Application](src/app/) - Check the demo app for more examples!

## 🐛 Troubleshooting

### Items not showing?

Make sure you set a height on the wrapper:

```css
bv-virtual-scroll-wrapper {
  height: 500px; /* Required! */
}
```

### Performance issues?

1. Use `trackBy` function
2. Use fixed `itemSize` if all items are the same height
3. Reduce `bufferSize` if rendering too many items

### Items jumping around?

This happens when using dynamic sizing. The component measures items after they render. Consider using `itemSize` for fixed heights.

## 💡 Tips

1. **Always set a height** on the wrapper component
2. **Use trackBy** for better performance with large lists
3. **Fixed size mode** is faster when all items are the same size
4. **Keep item templates simple** - avoid heavy computations in templates
5. **Adjust bufferSize** based on your scroll speed needs

## 🎉 Enjoy!

You're all set! Happy scrolling! 🚀

