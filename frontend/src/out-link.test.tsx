import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { OutLink } from './out-link';

test('an https URL renders a link that opens in a new tab', () => {
  render(<OutLink href="https://example.com/a" label="Repository" owner="Demo" />);
  const link = screen.getByRole('link', { name: 'Repository of Demo (opens in a new tab)' });
  expect(link).toHaveAttribute('href', 'https://example.com/a');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

test.each(['javascript:alert(1)', 'data:text/html,x', '', 'ftp://example.com'])(
  'a refused URL (%s) renders no link',
  (href) => {
    const { container } = render(<OutLink href={href} label="Repository" owner="Demo" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(container).toBeEmptyDOMElement();
  },
);
