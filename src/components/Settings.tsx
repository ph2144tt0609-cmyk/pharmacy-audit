import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

interface Props {
  onClose: () => void;
}

export function Settings({ onClose }: Props) {
  return (
    <div className="settings">
      <div className="list-head">
        <h2>設定</h2>
        <button type="button" onClick={onClose}>閉じる</button>
      </div>

      <DispenserMaster />
      <DrugMaster />
    </div>
  );
}

function DispenserMaster() {
  const dispensers = useLiveQuery(() => db.dispensers.orderBy('name').toArray());
  const [name, setName] = useState('');

  async function add() {
    const n = name.trim();
    if (!n) return;
    await db.dispensers.add({ name: n });
    setName('');
  }

  async function remove(id: number) {
    await db.dispensers.delete(id);
  }

  return (
    <section className="master">
      <h3>調剤者マスタ</h3>
      <p className="hint">入力画面の「調剤者」で選べる名前の一覧です。</p>

      <ul className="master-list">
        {dispensers?.map((d) => (
          <li key={d.id}>
            <span>{d.name}</span>
            <button type="button" className="remove" onClick={() => remove(d.id!)}>削除</button>
          </li>
        ))}
        {dispensers && dispensers.length === 0 && <li className="empty">登録がありません</li>}
      </ul>

      <div className="master-add">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="調剤者名を追加"
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button type="button" className="primary" onClick={add}>追加</button>
      </div>
    </section>
  );
}

function DrugMaster() {
  const drugs = useLiveQuery(() => db.drugs.orderBy('name').toArray());
  const [gtin, setGtin] = useState('');
  const [name, setName] = useState('');

  async function add() {
    const g = gtin.trim();
    const n = name.trim();
    if (!g || !n) return;
    await db.drugs.put({ gtin: g, name: n });
    setGtin('');
    setName('');
  }

  async function rename(g: string, newName: string) {
    await db.drugs.put({ gtin: g, name: newName });
  }

  async function remove(g: string) {
    await db.drugs.delete(g);
  }

  return (
    <section className="master">
      <h3>薬品マスタ（GTIN ↔ 薬品名）</h3>
      <p className="hint">
        スキャンしたGTINに薬品名を紐づけておくと、次回から自動で薬品名が入ります。
        ここで手動の追加・修正もできます。
      </p>

      <ul className="master-list drug-list">
        {drugs?.map((d) => (
          <li key={d.gtin}>
            <span className="gtin">{d.gtin}</span>
            <input
              className="drug-name-edit"
              value={d.name}
              onChange={(e) => rename(d.gtin, e.target.value)}
            />
            <button type="button" className="remove" onClick={() => remove(d.gtin)}>削除</button>
          </li>
        ))}
        {drugs && drugs.length === 0 && <li className="empty">登録がありません</li>}
      </ul>

      <div className="master-add drug-add">
        <input
          value={gtin}
          onChange={(e) => setGtin(e.target.value)}
          placeholder="GTIN（14桁）"
          inputMode="numeric"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="薬品名"
        />
        <button type="button" className="primary" onClick={add}>追加</button>
      </div>
    </section>
  );
}
