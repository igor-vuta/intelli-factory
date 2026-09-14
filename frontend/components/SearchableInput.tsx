import ChoiceField from './ChoiceField';
import { useExperienceCopy } from '../hooks/useExperienceCopy';
import { type ComboboxOption } from './Combobox';

type Props = {
  suggestions: ComboboxOption[];
  text: string;
  selectedId: string;
  onChange: (text: string, id: string) => void;
  placeholder: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
};
export default function SearchableInput({
  suggestions,
  text,
  selectedId,
  onChange,
  ...props
}: Props) {
  const e = useExperienceCopy();
  return (
    <ChoiceField
      {...props}
      options={suggestions}
      text={text}
      value={selectedId}
      onTextChange={(value) => onChange(value, '')}
      onSelect={(id, label) => onChange(label, id)}
      emptyMessage={e('No catalogue match — your description will be used directly.')}
    />
  );
}
