import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatDateTime } from '../utils';

interface Props {
  onNew: () => void;
  onOpen: (id: number) => void;
}

export function PrescriptionList({ onNew, onOpen }: Props) {
  const items = useLiveQuery(() =>
    db.prescriptions.orderBy('createdAt').reverse().toArray(),
  );

  return (
    <div className="list">
      <div className="list-head">
        <h2>処方箋一覧</h2>
        <button type="button" className="primary" onClick={onNew}>+ 新規</button>
      </div>

      {!items && <p>読み込み中…</p>}
      {items && items.length === 0 && <p className="empty">まだ記録がありません</p>}

      <ul>
        {items?.map((p) => (
          <li key={p.id} onClick={() => onOpen(p.id!)}>
            <div className="meta">
              <span className="num">#{p.number}</span>
              <span className="date">{formatDateTime(p.createdAt)}</span>
            </div>
            <div className="sub">
              <span>操作者: {p.operator}</span>
              <span>散剤 {p.items.length}件</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
