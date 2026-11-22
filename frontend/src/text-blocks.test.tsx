import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { TextBlocks } from './text-blocks';

test('only filled entries are shown, each label tied to its text', () => {
  render(
    <TextBlocks
      entries={[
        ['Duties', 'Payments API'],
        ['Achievements', null],
        ['Notes', ''],
        ['Stack', <strong key="s">React</strong>],
      ]}
    />,
  );
  expect(screen.getByText('Duties').tagName).toBe('DT');
  expect(screen.getByText('Payments API').tagName).toBe('DD');
  expect(screen.getByText('React')).toBeInTheDocument();
  expect(screen.queryByText('Achievements')).not.toBeInTheDocument();
  expect(screen.queryByText('Notes')).not.toBeInTheDocument();
});

test('nothing is rendered when every entry is empty', () => {
  const { container } = render(
    <TextBlocks
      entries={[
        ['Duties', null],
        ['Notes', ''],
      ]}
    />,
  );
  expect(container).toBeEmptyDOMElement();
});
