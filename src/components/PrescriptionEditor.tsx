import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, lookupDrugName, rememberDrug, type Item, type Prescription } from '../db';
import { parseGS1 } from '../gs1';
import { decodeFromFile } from '../decode';
import { shrinkImage, uuid } from '../utils';
import { expiryStatus } from '../expiry';
import { CameraScanner } from './CameraScanner';
import './editor-extra.css';

interface Props {
  initial?: Prescription;
  onSaved: (id: number) => void;
  onCancel: () => void;
}

function emptyItem(): Item {
  return { id: uuid() };
}

export function PrescriptionEditor({ initial, onSaved, onCancel }: Props) {
  const dispensers = useLiveQuery(() => db.dispensers.orderBy('name').toArray());
  const [number, setNumber] = useState(initial?.number ?? '');
  const [operator, setOperator] = useState(initial?.operator ?? localStorage.getItem('operator') ?? '');
  const [items, setItems] = useState<Item[]>(initial?.items ?? [emptyItem()]);
  const [saving, setSaving] = useState(false);

  // 選択中の調剤者がマスタに無い場合でも選択肢に出す
  const names = dispensers?.map((d) => d.name) ?? [];
  const options = operator && !names.includes(operator) ? [operator, ...names] : names;

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
      alert('処方箋番号と調剤者を入力してください');
      return;
    }
    setSaving(true);
    try {
      localStorage.setItem('operator', operator);
      // GTIN ↔ 薬品名 をマスタに学習させる
      await Promise.all(
        items
          .filter((it) => it.gtin && it.drugName)
          .map((it) => rememberDrug(it.gtin!, it.drugName!)),
      );
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
          調剤者
          <select value={operator} onChange={(e) => setOperator(e.target.value)}>
            <option value="">選択してください</option>
            {options.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
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
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const photoUrl = item.weighPhoto ? URL.createObjectURL(item.weighPhoto) : null;

  // 読み取ったコード文字列を解析してフィールドへ反映する（写真・カメラ共通）
  async function applyScanText(text: string) {
    const parsed = parseGS1(text);
    const patch: Partial<Item> = {
      gs1Raw: parsed.raw,
      gtin: parsed.gtin,
      lot: parsed.lot,
      expiry: parsed.expiry,
      serial: parsed.serial,
    };
    // GTIN がマスタにあれば薬品名を自動入力（未入力のときのみ）
    if (parsed.gtin) {
      const known = await lookupDrugName(parsed.gtin);
      if (known && !item.drugName) {
        patch.drugName = known;
        setInfo(`薬品マスタから「${known}」を自動入力しました`);
      } else if (!known) {
        setInfo('このGTINは薬品マスタ未登録です。薬品名を入力して保存すると次回から自動入力されます');
      }
    }
    onChange(patch);
  }

  async function onGS1File(file: File) {
    setDecoding(true);
    setError(null);
    setInfo(null);
    try {
      const text = await decodeFromFile(file);
      await applyScanText(text);
    } catch {
      setError('コードを読み取れませんでした。もう一度撮影してください');
    } finally {
      setDecoding(false);
    }
  }

  function onCameraResult(text: string) {
    setScanning(false);
    setError(null);
    setInfo(null);
    void applyScanText(text);
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
        <legend>GS1コード（手動入力・訂正可）</legend>
        <button
          type="button"
          className="scan-btn"
          onClick={() => {
            setError(null);
            setInfo(null);
            setScanning(true);
          }}
        >
          カメラでスキャン
        </button>
        <label className="file-btn">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => e.target.files?.[0] && onGS1File(e.target.files[0])}
          />
          <span>{decoding ? '解析中…' : '写真から読み取り'}</span>
        </label>
        {error && <p className="error">{error}</p>}
        {info && <p className="info">{info}</p>}
        {scanning && (
          <CameraScanner onResult={onCameraResult} onClose={() => setScanning(false)} />
        )}
        <div className="gs1-fields">
          <label>
            GTIN
            <input
              inputMode="numeric"
              value={item.gtin ?? ''}
              onChange={(e) => onChange({ gtin: e.target.value })}
              placeholder="14桁の商品コード"
            />
          </label>
          <label>
            ロット
            <input
              value={item.lot ?? ''}
              onChange={(e) => onChange({ lot: e.target.value })}
              placeholder="ロット番号"
            />
          </label>
          <label>
            <span className="exp-label">
              有効期限
              {(() => {
                const st = expiryStatus(item.expiry);
                if (st === 'expired') return <span className="exp-badge expired">期限切れ</span>;
                if (st === 'soon') return <span className="exp-badge soon">期限間近</span>;
                return null;
              })()}
            </span>
            <input
              value={item.expiry ?? ''}
              onChange={(e) => onChange({ expiry: e.target.value })}
              placeholder="例: 2027-03-末"
            />
          </label>
          <label>
            シリアル
            <input
              value={item.serial ?? ''}
              onChange={(e) => onChange({ serial: e.target.value })}
              placeholder="シリアル番号"
            />
          </label>
        </div>
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
