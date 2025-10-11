import {
  Component,
  input,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ScrollDirection } from '@vladislavburko/virtual-scroll';

/**
 * Demo component for rendering virtual scroll items
 * This demonstrates how the item HTML from the demo can be extracted into a reusable component
 */
@Component({
  selector: 'app-virtual-scroll-item',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Vertical item -->
    @if (direction() === 'vertical') {
      <div
        class="item"
        [style.backgroundColor]="item().color"
        [style.minHeight.px]="item().height || 'auto'"
      >
        <div class="item-header">
          <span class="item-index">#{{ index() }}</span>
          <span class="item-id">ID: {{ item().id }}</span>
        </div>
        <div class="item-content">
          {{ item().text }}
        </div>
        <div class="item-footer" *ngIf="item().height">
          Height: {{ item().height }}px
        </div>
      </div>
    }

    <!-- Horizontal item -->
    @if (direction() === 'horizontal') {
      <div
        class="item horizontal-item"
        [style.backgroundColor]="item().color"
      >
        <div class="item-header">
          <span class="item-index">#{{ index() }}</span>
        </div>
        <div class="item-content">
          {{ item().text }}
        </div>
      </div>
    }
  `,
  styles: [`
    .item {
  padding: 1rem;
  margin: 0.5rem;
  border-radius: 8px;
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.item:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.horizontal-item {
  width: 250px;
  height: 300px;
  margin: 1rem;
}

.horizontal-item:hover {
  transform: translateY(-4px);
}

.item-header {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  font-size: 0.9rem;
  opacity: 0.9;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
}

.item-index {
  background: rgba(0, 0, 0, 0.2);
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
}

.item-id {
  font-family: monospace;
}

.item-content {
  flex: 1;
  font-size: 1rem;
  line-height: 1.5;
}

.item-footer {
  font-size: 0.85rem;
  opacity: 0.8;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.3);
}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VirtualScrollItemComponent implements OnInit {
  // Inputs
  item = input.required<any>();
  index = input.required<number>();
  direction = input.required<ScrollDirection>();

  ngOnInit(): void {
    console.log('VirtualScrollItemComponent initialized');
  }
}

