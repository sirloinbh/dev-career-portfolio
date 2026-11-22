import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import { createQueryClient } from '../lib/query';

// Screens rendered through <App /> get App's client (#152); a screen rendered on its own gets a fresh client here,
// with retries off so a test sees a failure at once. serve-list.ts fakes the list it loads.

/** A fresh QueryClient (no retries) around a screen rendered without <App />. */
export function TestQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() =>
    createQueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
