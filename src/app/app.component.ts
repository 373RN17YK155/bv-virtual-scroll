import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  VirtualScrollWrapperComponent,
  ScrollDirection
} from '@vladislavburko/virtual-scroll';
import { VirtualScrollItemComponent } from './virtual-scroll-item.component';

interface DemoItem {
  id: number;
  text: string;
  color: string;
  height?: number;
}

type DemoMode = 'dynamic-vertical' | 'fixed-vertical' | 'horizontal' | 'large-dataset';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    VirtualScrollWrapperComponent,
    VirtualScrollItemComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'Virtual Scroll Demo';
  currentMode: DemoMode = 'dynamic-vertical';

  // Demo data
  dynamicItems: DemoItem[] = [];
  fixedItems: DemoItem[] = [];
  horizontalItems: DemoItem[] = [];
  largeDataset: DemoItem[] = [];

  // Performance metrics
  totalItems = 0;
  renderedItems = 0;

  constructor() {
    this.generateDemoData();
  }

  private generateDemoData(): void {
    // Dynamic height items (100 items with varying heights)
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
    this.dynamicItems = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      text: `Dynamic Item ${i + 1} - ${this.getRandomText()}`,
      color: colors[i % colors.length],
      height: Math.floor(Math.random() * 100) + 50 // 50-150px
    }));

    // Fixed height items (200 items)
    this.fixedItems = Array.from({ length: 200 }, (_, i) => ({
      id: i,
      text: `Fixed Item ${i + 1}`,
      color: colors[i % colors.length]
    }));

    // Horizontal items (50 items)
    this.horizontalItems = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      text: `Item ${i + 1}`,
      color: colors[i % colors.length]
    }));

    // Large dataset (10,000 items)
    this.largeDataset = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      text: `Item ${i + 1}`,
      color: colors[i % colors.length],
      height: Math.floor(Math.random() * 80) + 40
    }));
  }

  private getRandomText(): string {
    const texts = [
      'This is a short text.',
      'This is a longer text that will make the item taller and demonstrate dynamic height handling.',
      'Medium length text for variety.',
      'Another text sample that shows how the virtual scroll handles different content sizes seamlessly.',
      'Simple text.'
    ];
    return texts[Math.floor(Math.random() * texts.length)];
  }

  setMode(mode: DemoMode): void {
    this.currentMode = mode;
    this.updateMetrics();
  }

  get currentItems(): DemoItem[] {
    switch (this.currentMode) {
      case 'dynamic-vertical':
        return this.dynamicItems;
      case 'fixed-vertical':
        return this.fixedItems;
      case 'horizontal':
        return this.horizontalItems;
      case 'large-dataset':
        return this.largeDataset;
      default:
        return [];
    }
  }

  get currentDirection(): ScrollDirection {
    return this.currentMode === 'horizontal' ? 'horizontal' : 'vertical';
  }

  get fixedItemSize(): number | undefined {
    return this.currentMode === 'fixed-vertical' ? 60 : undefined;
  }

  trackByItemId(index: number, item: DemoItem): number {
    return item.id;
  }

  private updateMetrics(): void {
    this.totalItems = this.currentItems.length;
    // Note: In a real implementation, you'd get this from the virtual scroll component
    this.renderedItems = Math.min(20, this.totalItems); // Approximate
  }

  getModeDescription(): string {
    switch (this.currentMode) {
      case 'dynamic-vertical':
        return 'Vertical scrolling with dynamic item heights. Each item has different height based on content.';
      case 'fixed-vertical':
        return 'Vertical scrolling with fixed item height (60px). Optimized for uniform lists.';
      case 'horizontal':
        return 'Horizontal scrolling demonstration. Swipe left/right to navigate.';
      case 'large-dataset':
        return 'Large dataset with 10,000 items. Notice the smooth performance!';
      default:
        return '';
    }
  }
}
