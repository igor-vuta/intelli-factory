import type { AttributeSchema } from './CategoryProposalPanel';
export default function AttributeFields({
  schema,
  value,
  onChange,
}: {
  schema?: AttributeSchema | null;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  if (schema?.type !== 'object') return null;
  return (
    <>
      {Object.entries(schema.properties ?? {}).map(([key, field]) => (
        <label key={key}>
          {key}
          {field.unit ? ` (${field.unit})` : ''}
          {schema.required?.includes(key) ? ' *' : ''}
          {field.enum ? (
            <select
              value={String(value[key] ?? '')}
              onChange={(e) =>
                onChange({
                  ...value,
                  [key]:
                    field.type === 'number' || field.type === 'integer'
                      ? Number(e.target.value)
                      : e.target.value,
                })
              }
            >
              <option value="">—</option>
              {field.enum.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ) : field.type === 'boolean' ? (
            <select
              value={String(value[key] ?? '')}
              onChange={(e) => onChange({ ...value, [key]: e.target.value === 'true' })}
            >
              <option value="">—</option>
              <option value="true">✓</option>
              <option value="false">✕</option>
            </select>
          ) : (
            <input
              type={field.type === 'string' ? 'text' : 'number'}
              min={field.minimum}
              max={field.maximum}
              step={field.type === 'integer' ? 1 : 'any'}
              value={String(value[key] ?? '')}
              onChange={(e) =>
                onChange({
                  ...value,
                  [key]:
                    field.type === 'string'
                      ? e.target.value
                      : e.target.value === ''
                        ? undefined
                        : Number(e.target.value),
                })
              }
            />
          )}
        </label>
      ))}
    </>
  );
}
