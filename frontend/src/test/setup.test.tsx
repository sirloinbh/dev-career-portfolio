import { render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { expect, test } from 'vitest';

// A whole-page role query can take over a second when the PC is busy (#57). The shared wait must
// outlast that, so a slow PC is not reported as a broken screen.
function ShowsLater({ after }: { after: number }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), after);
    return () => clearTimeout(timer);
  }, [after]);
  return shown ? <h1>목록</h1> : <p>불러오는 중</p>;
}

test('a screen that takes longer than a second is still waited for', async () => {
  render(<ShowsLater after={1500} />);
  expect(await screen.findByRole('heading', { name: '목록' })).toBeInTheDocument();
});
