import { useExperienceCopy } from '../hooks/useExperienceCopy';

/** "Showing 1–5 of 41" with previous and next page buttons, translated. */
export default function TablePager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const e = useExperienceCopy();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total ? (page - 1) * pageSize + 1 : 0;
  return (
    <div className="table-pager">
      <span className="num">
        {e('Showing')} {first}–{Math.min(page * pageSize, total)} {e('of')} {total}
      </span>
      {pages > 1 && (
        <div>
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            {e('Previous')}
          </button>
          <span className="num">
            {page} / {pages}
          </span>
          <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            {e('Next')}
          </button>
        </div>
      )}
    </div>
  );
}
