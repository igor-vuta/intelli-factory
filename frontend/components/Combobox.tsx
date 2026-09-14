import ChoiceField from './ChoiceField';
import { useExperienceCopy } from '../hooks/useExperienceCopy';
export type ComboboxOption = { id: string; label: string; sublabel?: string };
type Props = {
  options: ComboboxOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  label: string;
  disabled?: boolean;
  allowEmpty?: boolean;
  required?: boolean;
};
export default function Combobox({ options, onChange, allowEmpty, ...props }: Props) {
  const e = useExperienceCopy();
  return (
    <ChoiceField
      {...props}
      options={allowEmpty ? [{ id: '', label: e('None') }, ...options] : options}
      onSelect={onChange}
    />
  );
}
