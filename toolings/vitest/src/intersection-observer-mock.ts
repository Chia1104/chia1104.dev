type IntersectionObserverCallback = (
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver
) => void;

class IntersectionObserverMock {
  private callback: IntersectionObserverCallback;
  private options: IntersectionObserverInit;
  private elements: Element[];

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ) {
    this.callback = callback;
    this.options = options || {};
    this.elements = [];
  }

  observe(element: Element): void {
    this.elements.push(element);
    // 立即觸發 callback，模擬元素已經在視窗範圍內
    // 你可以根據測試的需要，修改這裡的 isIntersecting 和其他屬性
    const entry: IntersectionObserverEntry = {
      isIntersecting: true,
      target: element,
      boundingClientRect: element.getBoundingClientRect(),
      intersectionRatio: 1, // 完全在視窗範圍內
      intersectionRect: element.getBoundingClientRect(),
      // @ts-expect-error
      rootBounds: this.options.root?.getBoundingClientRect() || null,
      time: Date.now(),
    };
    // @ts-expect-error
    this.callback([entry], this);
  }

  unobserve(element: Element): void {
    this.elements = this.elements.filter((el) => el !== element);
  }

  disconnect(): void {
    this.elements = [];
  }
}

export default IntersectionObserverMock;
