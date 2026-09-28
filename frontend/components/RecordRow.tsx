import type { ReactNode } from 'react';

/**
 * A table row that opens a detail row beneath it. The title is the disclosure button; a click
 * anywhere else on the row (outside other controls) toggles it too, so rows feel like cards.
 */
export default function RecordRow({
  id,
  open,
  onToggle,
  title,
  subtitle,
  colSpan,
  children,
  detail,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  colSpan: number;
  /** The remaining cells of the row. */
  children: ReactNode;
  detail: ReactNode;
}) {
  return (
    <>
      <tr
        id={`record-${id}`}
        className={open ? 'record-row is-open' : 'record-row'}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('button, a, input, select, textarea, [role="combobox"], label'))
            return;
          if (window.getSelection()?.toString()) return;
          onToggle();
        }}
      >
        <td className="record-title">
          <button
            type="button"
            className="record-toggle"
            aria-expanded={open}
            aria-controls={`record-detail-${id}`}
            onClick={onToggle}
          >
            <span className="record-chevron" aria-hidden="true" />
            <span>{title}</span>
          </button>
          {subtitle}
        </td>
        {children}
      </tr>
      {open && (
        <tr id={`record-detail-${id}`} className="record-detail">
          <td colSpan={colSpan}>{detail}</td>
        </tr>
      )}
    </>
  );
}

/** The inside of an opened record: labelled facts, optional content (e.g. a form), actions. */
export function RecordDetail({
  facts,
  children,
  actions,
}: {
  facts: [ReactNode, ReactNode][];
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="record-detail-body">
      <dl className="record-facts">
        {facts.map(([label, value], i) => (
          <div key={i}>
            <dt>{label}</dt>
            <dd>{value ?? '—'}</dd>
          </div>
        ))}
      </dl>
      {children}
      {actions && <div className="record-detail-actions">{actions}</div>}
    </div>
  );
}
