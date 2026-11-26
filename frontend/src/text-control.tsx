import type { ComponentProps } from 'react';

import { Combobox } from './components/ui/combobox';
import { Input } from './components/ui/input';

// A one-line form field (#247). With `known` (the values already used in this field) it suggests them in a
// Combobox and still accepts a new value; without it, it is a plain Input.
type Props = Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  known?: readonly string[];
};

export function TextControl({ known, onValueChange, ...props }: Props) {
  if (known) {
    return (
      <Combobox
        {...props}
        onValueChange={onValueChange}
        options={known}
        listLabel="Earlier values"
      />
    );
  }
  return <Input {...props} onChange={(e) => onValueChange(e.target.value)} />;
}
