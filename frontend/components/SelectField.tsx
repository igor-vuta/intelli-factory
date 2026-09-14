import { Children, isValidElement, type ReactNode } from 'react';
import ChoiceField, { type Choice } from './ChoiceField';
import { useExperienceCopy } from '../hooks/useExperienceCopy';

type Props = {
  children: ReactNode;
  value: string;
  onChange: (event: { target: { value: string } }) => void;
  id?: string;
  name?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
};
function text(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child) ? text(child.props.children) : String(child)
    )
    .join('');
}
export default function SelectField({ children, onChange, ...props }: Props) {
  const e = useExperienceCopy();
  const options: Choice[] = [];
  function collect(nodes: ReactNode) {
    Children.forEach(nodes, (node) => {
      if (!isValidElement<{ value?: string; children?: ReactNode; disabled?: boolean }>(node))
        return;
      if (node.type === 'option')
        options.push({
          id: String(node.props.value ?? text(node.props.children)),
          label: e(text(node.props.children)),
          disabled: node.props.disabled,
        });
      else collect(node.props.children);
    });
  }
  collect(children);
  return (
    <ChoiceField
      {...props}
      aria-label={props['aria-label'] ? e(props['aria-label']) : undefined}
      options={options}
      onSelect={(value) => onChange({ target: { value } })}
    />
  );
}
