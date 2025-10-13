import { Component, computed, effect, ElementRef, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-clean',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="clean-container">
      <div  class="content">
        <h1>Clean Component</h1>
        <p>This is a new clean component ready for your implementation.</p>
        <div #contentContainer class="list">
        <div [style.height.px]="listSize()" class="list-item-container">
          @for (item of itemsForDraw(); track $index) {
          <div
           class="list-item"
           [style.transform]="'translateY(' + item.offset + 'px)'"
          >
            <div
              class="info-box"

            >
              <h4>{{ item.data.header }}</h4>
              <p>{{ item.data.content }}</p>
            </div>
            </div>
          }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .clean-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #3a7bd5 0%, #00d2ff 100%);
      padding: 2rem;
    }

    .content {
      background: white;
      padding: 3rem;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      max-width: 600px;
      width: 100%;
    }

    h1 {
      color: #333;
      margin: 0 0 1rem 0;
      font-size: 2.5rem;
    }

    p {
      color: #666;
      line-height: 1.6;
      margin: 0 0 2rem 0;
    }

    .list {
      display: flex;
      flex-direction: column;
      height: 300px;
      overflow-y: auto;
    }

    .list-item-container {
      position: relative;
    }

    .list-item {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      will-change: transform;
      contain: layout style paint;
    }

    .info-box {

      margin:4px;
      background: #f0f9ff;
      padding: 8px;
      border-radius: 4px;
    }

    .info-box h4 {
      color: #3a7bd5;
      margin-block: 0;
      line-height: 1.3;
    }

    .info-box p {
      margin: 0;
      color: #555;
      line-height: 1.3;
    }
  `]
})
export class CleanComponent {
  contentContainer = viewChild<ElementRef<HTMLDivElement>>('contentContainer');
  contentContainerHeight = computed(() => this.contentContainer()?.nativeElement.clientHeight ?? 0);

  items = signal<{ header: string, content: string }[]>(this.generateItems(100));
  itemsForDraw = signal<{ data: { header: string, content: string }, offset: number }[]>([]);
  itemsCache = new Map<number, { height: number, offset: number }>();
  mutationObserver: MutationObserver;
  listSize = signal(0);


  constructor() {
    let nextItemOffset = 0;
    let nextItemindex = 0;

    effect(() => {
      const contentContainer = this.contentContainer()?.nativeElement as Node

      this.mutationObserver.observe(contentContainer, {
        childList: true,
        subtree: true,
      });

      this.itemsForDraw.set([{ data: this.items()[nextItemindex], offset: nextItemOffset }]);

    }, { allowSignalWrites: true });



    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        const contentContainerHeight = this.contentContainerHeight();
        const listSize = this.listSize();

        if (nextItemindex < this.items().length - 1 && contentContainerHeight > listSize) {
          this.itemsForDraw.update(items => {
            const addedNode = mutation.addedNodes[0] as HTMLElement;
            const offset = addedNode.clientHeight + nextItemOffset;
            nextItemOffset = offset;
            nextItemindex++;
            this.itemsCache.set(nextItemindex, { height: addedNode.clientHeight, offset: nextItemOffset });
            this.listSize.update(size => size + addedNode.clientHeight);
            return items.concat({ data: this.items()[nextItemindex], offset: nextItemOffset })
          });
        }

      });
    });

  }

  generateItems(length: number): { header: string, content: string }[] {
    return Array.from({ length }, (_, i) => ({
      header: `Header ${i + 1}`,
      content: `Content ${i + 1}`
    }))
  }
}

