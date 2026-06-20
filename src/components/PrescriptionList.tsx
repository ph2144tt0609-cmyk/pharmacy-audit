import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Item } from '../db';
import { formatDateTime } from '../utils';
import './list-extra.css';

interface Props {
  onNew: () => void;
  onOpen: (id: number) => void;
}

// 未完了アイテムの件数を数える。
// アイテムは「秤量写真が無い」か「薬品の特定情報（gtin・drugName）が両方とも空」の
// いずれかに該当する場合に未完了とみなす。
function countIncomplete(items: Item[]): number {
  return items.reduce((n, item) => {
    const noPhoto = !item.weighPhoto;
    const noDrug = !item.gtin?.trim() && !item.drugName?.trim();
    return n + (noPhoto || noDrug ? 1 : 0);
  }, 0);
}

export function PrescriptionList({ onNew, onOpen }: Props) {
  const items = useLiveQuery(() =>
    db.prescriptions.orderBy('createdAt').reverse().toArray(),
  );

  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = useMemo(() => {
    if (!items) return undefined;
    const q = query.trim().toLowerCase();
    return items.filter((p) => {
      if (q) {
        const num = (p.number ?? '').toString().toLowerCase();
        const op = (p.operator ?? '').toString().toLowerCase();
        if (!num.includes(q) && !op.includes(q)) return false;
      }
      if (dateFrom || dateTo) {
        // ローカル日付（YYYY-MM-DD）で比較。時刻は無視、両端含む
        const d = new Date(p.createdAt);
        const y = d.getFullYear();
        const m = `${d.getMonth() + 1}`.padStart(2, '0');
        const day = `${d.getDate()}`.padStart(2, '0');
        const ymd = `${y}-${m}-${day}`;
        if (dateFrom && ymd < dateFrom) return false;
        if (dateTo && ymd > dateTo) return false;
      }
      return true;
    });
  }, [items, query, dateFrom, dateTo]);

  const hasFilter = query.trim() !== '' || dateFrom !== '' || dateTo !== '';

  return (
    <div className="list">
      <div className="list-head">
        <h2>処方箋一覧</h2>
        <button type="button" className="primary" onClick={onNew}>+ 新規</button>
      </div>

      {!items && <p>読み込み中…</p>}
      {items && items.length === 0 && <p className="empty">まだ記録がありません</p>}

      {items && items.length > 0 && (
        <div className="list-filter">
          <input
            type="text"
            className="filter-search"
            placeholder="番号・調剤者で検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="filter-dates">
            <input
              type="date"
              aria-label="開始日"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <span className="date-sep">〜</span>
            <input
              type="date"
              aria-label="終了日"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="filter-foot">
            <span className="filter-count">{filtered?.length ?? 0}件</span>
            {hasFilter && (
              <button
                type="button"
                className="filter-clear"
                onClick={() => {
                  setQuery('');
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                クリア
              </button>
            )}
          </div>
        </div>
      )}

      {items && items.length > 0 && filtered && filtered.length === 0 && (
        <p className="empty">該当する記録がありません</p>
      )}

      <ul>
        {filtered?.map((p) => {
          const incomplete = countIncomplete(p.items);
          return (
          <li key={p.id} onClick={() => onOpen(p.id!)}>
            <div className="meta">
              <span className="num">#{p.number}</span>
              <span className="date">{formatDateTime(p.createdAt)}</span>
              {incomplete > 0 && (
                <span className="incomplete-badge">未完了 {incomplete}件</span>
              )}
            </div>
            <div className="sub">
              <span>調剤者: {p.operator}</span>
              <span>散剤 {p.items.length}件</span>
            </div>
            <div className="list-actions">
              <button
                type="button"
                className="remove"
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    p.id !== undefined &&
                    window.confirm(`処方箋 #${p.number} を削除しますか？この操作は取り消せません。`)
                  ) {
                    void db.prescriptions.delete(p.id);
                  }
                }}
              >
                削除
              </button>
            </div>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
