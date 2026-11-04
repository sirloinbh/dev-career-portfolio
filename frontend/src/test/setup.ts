import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// findBy* and waitFor give up after 1 second by default. A role query over the whole page takes
// 50-250 ms on its own and several seconds when the PC is busy (#57), so screen tests failed at
// random. The wait stays under vitest's testTimeout (15 s) so a real failure still shows the page.
configure({ asyncUtilTimeout: 10_000 });

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
