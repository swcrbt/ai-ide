import { vi } from 'vitest';
import '@testing-library/jest-dom';

// 确保 document 在全局可用
if (typeof document === 'undefined') {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  global.window = dom.window;
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(document, 'documentElement', {
  writable: true,
  value: {
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
    },
  },
});

Object.defineProperty(document, 'queryCommandSupported', {
  writable: true,
  value: vi.fn(() => false),
});
