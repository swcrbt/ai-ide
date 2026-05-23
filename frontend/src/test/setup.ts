import '@testing-library/jest-dom';

// 模拟 window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// 模拟 document.documentElement
Object.defineProperty(document, 'documentElement', {
  writable: true,
  value: {
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
    },
  },
});
