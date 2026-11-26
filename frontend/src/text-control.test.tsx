import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { TextControl } from './text-control';

test('without known values it is a plain text field', () => {
  const onValueChange = vi.fn();
  render(<TextControl aria-label="School" value="" onValueChange={onValueChange} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'School' }), {
    target: { value: 'Yonsei' },
  });
  expect(onValueChange).toHaveBeenCalledWith('Yonsei');
});

test('with known values it suggests them and still accepts a new value', () => {
  const onValueChange = vi.fn();
  render(
    <TextControl
      aria-label="School"
      value="Yo"
      onValueChange={onValueChange}
      known={['Yonsei', 'KAIST']}
    />,
  );
  const field = screen.getByRole('combobox', { name: 'School' });
  fireEvent.keyDown(field, { key: 'ArrowDown' });
  expect(screen.getByRole('option', { name: 'Yonsei' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'KAIST' })).not.toBeInTheDocument();
  fireEvent.change(field, { target: { value: 'Yonsei Graduate School' } });
  expect(onValueChange).toHaveBeenCalledWith('Yonsei Graduate School');
});
