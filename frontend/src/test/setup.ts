import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// findBy* and waitFor give up after 1 second by default. A role query over the whole page takes
// 50-250 ms on its own and several seconds when the PC is busy (#57), so screen tests failed at
// random. 8 s covers the slowest wait measured (8.1 s with three suites at once) and leaves about
// 7 s of vitest's testTimeout (15 s) for the rest of the test, so a real failure usually ends with
// Testing Library's message and the page. A test that has already run long can still hit
// testTimeout first (#60).
configure({ asyncUtilTimeout: 8_000 });

// jsdom has no matchMedia; the toaster and drawer read it to follow the system theme.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.className = '';
  // Pages are URLs; each test starts on the overview.
  window.history.replaceState(null, '', '/');
});
