import { useState } from 'react';
import { db, type Item, type Prescription } from '../db';
import { parseGS1 } from '../gs1';
import { decodeFromFile } from '../decode';
import { shrinkImage, uuid } from '../utils';

interface Props {
  initial?: Prescription;
  onSaved: (id: number) => void;
  onCancel: () => void;
}

function emptyItem(): Item {
  return { id: uuid() };
}

export function PrescriptionEditor({ initial, onSaved, onCancel }: Props) {
  const [number, setNumber] = useState(initial?.number ?? '');
  const [operator, setOperator] = useState(initial?.operator ?? localStorage.getItem('operator') ?? '');
  const [items, setItems] = useState<Item[]>(initial?.items ?? [emptyItem()]);
  const [saving, setSaving] = useState(false);

  function patchItem(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  }

  async function save() {
    if (!number.trim() || !operator.trim()) {
      alert('処方箋番号と操作者名を入力してください');
      return;
    }
    setSaving(true);
    try {
      localStorage.setItem('operator', operator);
      const record: Prescription = {
        id: initial?.id,
        number: number.trim(),
        operator: operator.trim(),
        createdAt: initial?.createdAt ?? new Date(),
        items,
      };
      const id = initial?.id
        ? (await db.prescriptions.put(record), initial.id)
        : ((await db.prescriptions.add(record)) as number);
      onSaved(id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="editor">
      <h2>{initial ? '処方箋を編集' : '新しい処方箋'}</h2>

      <div className="row">
        <label>
          処方箋番号
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="例: 12345" />
        </label>
        <label>
          操作者名
          <input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="例: 山田" />
        </label>
      </div>

      <div className="items">
        {items.map((it, i) => (
          <ItemEditor key={it.id} index={i} item={it} onChange={(p) => patchItem(it.id, p)} onRemove={() => removeItem(it.id)} canRemove={items.length > 1} />
        ))}
      </div>

      <button type="button" className="add" onClick={addItem}>+ 散剤を追加</button>

      <div className="actions">
        <button type="button" onClick={onCancel}>キャンセル</button>
        <button type="button" className="primary" disabled={saving} onClick={save}>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  );
}

function ItemEditor({
  index,
  item,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  item: Item;
  onChange: (p: Partial<Item>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [decoding, setDecoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoUrl = item.weighPhoto ? URL.createObjectURL(item.weighPhoto) : null;

  async function onGS1File(file: File) {
    setDecoding(true);
    setError(null);
    try {
      const text = await decodeFromFile(file);
      const parsed = parseGS1(text);
      onChange({
        gs1Raw: parsed.raw,
        gtin: parsed.gtin,
        lot: parsed.lot,
        expiry: parsed.expiry,
        serial: parsed.serial,
      });
    } catch {
      setError('コードを読み取れませんでした。もう一度撮影してください');
    } finally {
      setDecoding(false);
    }
  }

  async function onWeighFile(file: File) {
    const blob = await shrinkImage(file);
    onChange({ weighPhoto: blob, weighPhotoMime: 'image/jpeg' });
  }

  return (
    <div className="item">
      <div className="item-head">
        <span className="num">#{index + 1}</span>
        {canRemove && (
          <button type="button" className="remove" onClick={onRemove}>削除</button>
        )}
      </div>

      <label>
        薬品名(任意)
        <input value={item.drugName ?? ''} onChange={(e) => onChange({ drugName: e.target.value })} />
      </label>

      <fieldset>
        <legend>GS1コード</legend>
        <label className="file-btn">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => e.target.files?.[0] && onGS1File(e.target.files[0])}
          />
          <span>{decoding ? '解析中…' : 'コードを撮影して読み取り'}</span>
        </label>
        {error && <p className="error">{error}</p>}
        {item.gtin && (
          <dl className="gs1">
            {item.gtin && (<><dt>GTIN</dt><dd>{item.gtin}</dd></>)}
            {item.lot && (<><dt>ロット</dt><dd>{item.lot}</dd></>)}
            {item.expiry && (<><dt>有効期限</dt><dd>{item.expiry}</dd></>)}
            {item.serial && (<><dt>シリアル</dt><dd>{item.serial}</dd></>)}
          </dl>
        )}
      </fieldset>

      <fieldset>
        <legend>秤量</legend>
        <label>
          g数(任意)
          <input
            inputMode="decimal"
            value={item.grams ?? ''}
            onChange={(e) => onChange({ grams: e.target.value })}
            placeholder="例: 1.50"
          />
        </label>
        <label className="file-btn">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => e.target.files?.[0] && onWeighFile(e.target.files[0])}
          />
          <span>{photoUrl ? '写真を撮り直し' : '秤量写真を撮影'}</span>
        </label>
        {photoUrl && <img className="thumb" src={photoUrl} alt="秤量写真" />}
      </fieldset>
    </div>
  );
}
