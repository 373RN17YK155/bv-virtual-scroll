import { Component, signal, TemplateRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ObserverVirtualScrollComponent } from './observer-virtual-scroll.component';

interface DemoItem {
  id: number;
  title: string;
  description: string;
  color: string;
}

@Component({
  selector: 'app-observer-demo',
  standalone: true,
  imports: [CommonModule, ObserverVirtualScrollComponent],
  template: `
    <div class="demo-container">
      <div class="header">
        <h1>Observer-Based Virtual Scroll Demo</h1>
        <p class="subtitle">Using MutationObserver, IntersectionObserver, and ResizeObserver</p>

        <div class="controls">
          <button (click)="changeItemCount(100)" [class.active]="items().length === 100">
            100 Items
          </button>
          <button (click)="changeItemCount(500)" [class.active]="items().length === 500">
            500 Items
          </button>
          <button (click)="changeItemCount(1000)" [class.active]="items().length === 1000">
            1,000 Items
          </button>
          <button (click)="changeItemCount(5000)" [class.active]="items().length === 5000">
            5,000 Items
          </button>
          <button (click)="changeItemCount(10000)" [class.active]="items().length === 10000">
            10,000 Items
          </button>
        </div>

        <div class="info">
          <div class="info-item">
            <span class="label">Total Items:</span>
            <span class="value">{{ items().length }}</span>
          </div>
          <div class="info-item">
            <span class="label">Default Height:</span>
            <span class="value">{{ defaultHeight() }}px</span>
          </div>
          <div class="info-item">
            <span class="label">Buffer:</span>
            <span class="value">{{ buffer() }} items</span>
          </div>
        </div>
      </div>

      <div class="scroll-wrapper">
        <app-observer-virtual-scroll
          [items]="items()"
          [defaultItemHeight]="defaultHeight()"
          [bufferSize]="buffer()"
          [itemTemplate]="itemTpl"
        />
      </div>

      <ng-template #itemTpl let-item let-index="index">
        <div class="item-card" [style.background]="item.color">
          <div class="item-header">
            <span class="item-id">#{{ item.id }}</span>
            <span class="item-index">Index: {{ index }}</span>
          </div>
          <h3 class="item-title">{{ item.title }}</h3>
          <p class="item-description">{{ item.description }}</p>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .demo-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
      box-sizing: border-box;
    }

    .header {
      background: white;
      padding: 2rem;
      border-radius: 16px 16px 0 0;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    h1 {
      margin: 0 0 0.5rem 0;
      color: #1a202c;
      font-size: 2rem;
      font-weight: 700;
    }

    .subtitle {
      margin: 0 0 1.5rem 0;
      color: #718096;
      font-size: 0.95rem;
    }

    .controls {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }

    .controls button {
      padding: 0.625rem 1.25rem;
      border: 2px solid #667eea;
      background: white;
      color: #667eea;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.875rem;
      transition: all 0.2s;
    }

    .controls button:hover {
      background: #667eea;
      color: white;
      transform: translateY(-1px);
    }

    .controls button.active {
      background: #667eea;
      color: white;
    }

    .info {
      display: flex;
      gap: 2rem;
      padding: 1rem;
      background: #f7fafc;
      border-radius: 8px;
      flex-wrap: wrap;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .label {
      font-size: 0.75rem;
      color: #718096;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .value {
      font-size: 1.25rem;
      color: #1a202c;
      font-weight: 700;
    }

    .scroll-wrapper {
      flex: 1;
      background: white;
      border-radius: 0 0 16px 16px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .item-card {
      margin: 8px 12px;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .item-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }

    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .item-id {
      font-size: 0.75rem;
      font-weight: 700;
      color: rgba(0, 0, 0, 0.6);
      background: rgba(255, 255, 255, 0.5);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }

    .item-index {
      font-size: 0.75rem;
      color: rgba(0, 0, 0, 0.5);
      font-weight: 600;
    }

    .item-title {
      margin: 0 0 0.5rem 0;
      color: rgba(0, 0, 0, 0.9);
      font-size: 1.125rem;
      font-weight: 600;
    }

    .item-description {
      margin: 0;
      color: rgba(0, 0, 0, 0.7);
      font-size: 0.875rem;
      line-height: 1.5;
    }
  `]
})
export class ObserverDemoComponent {
  items = signal<DemoItem[]>([]);
  defaultHeight = signal<number>(120);
  buffer = signal<number>(3);

  itemTemplate = viewChild<TemplateRef<any>>('itemTpl');

  private colors = [
    '#FFE5E5', '#E5F3FF', '#E5FFE5', '#FFF5E5', '#F5E5FF',
    '#FFE5F5', '#E5FFFF', '#FFFFE5', '#FFE5CC', '#E5CCFF'
  ];

  constructor() {
    this.changeItemCount(1000);
  }

  changeItemCount(count: number): void {
    this.items.set(this.generateItems(count));
  }

  private generateItems(count: number): DemoItem[] {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title: `Item ${i + 1}`,
      description: this.getRandomDescription(),
      color: this.colors[i % this.colors.length]
    }));
  }

  private getRandomDescription(): string {
    const descriptions = [
      'This is a demo item rendered using observer-based virtual scrolling.',
      'Virtual scrolling improves performance by only rendering visible items.',
      'This implementation uses IntersectionObserver to track visibility.',
      'MutationObserver helps us track when items are added to the DOM.',
      'ResizeObserver ensures we adapt to container size changes.',
      'No scroll event listeners needed - just observers doing their work!',
      'Each item can have different heights - they are measured dynamically.',
      'Buffer items are rendered above and below for smooth scrolling.',
      'This approach provides excellent performance even with thousands of items.',
      'The virtual scroll container adapts to your content automatically.'
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }
}

