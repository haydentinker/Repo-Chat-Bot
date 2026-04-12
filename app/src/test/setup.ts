import "@testing-library/jest-dom";

// Mantine uses window.matchMedia — jsdom doesn't implement it.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom doesn't implement scrollIntoView.
window.HTMLElement.prototype.scrollIntoView = () => {};

// jsdom doesn't implement ResizeObserver (used by Mantine).
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
