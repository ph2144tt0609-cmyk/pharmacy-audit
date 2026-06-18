import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { exportBackup, importBackup } from '../backup';
import { importDrugsCsv, importDrugsJson, exportDrugsCsv } from '../drugImport';
import { gtinMasterStatus, loadGtinMaster, type GtinMasterStatus } from '../gtinMaster';
import { getSoonDays, setSoonDays } from '../expiry';
import './settings-extra.css';

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
      <ExpiryThresholdSection />
      <GtinMasterSection />
      <DrugMaster />
      <BackupSection />
    </div>
  );
}

function ExpiryThresholdSection() {
  const [days, setDays] = useState<number>(() => getSoonDays());
  const [saved, setSaved] = useState(false);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // 空欄や数字以外は確定保存しない（入力途中を許容）
    if (raw.trim() === '') {
      setSaved(false);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const applied = setSoonDays(n);
    setDays(applied);
    setSaved(true);
  }

  return (
    <section className="master">
      <h3>期限間近とみなす日数</h3>
      <p className="hint">
        有効期限まで{days}日以内のものを「期限間近」として警告します（1〜3650日）。
        変更すると即時に保存され、この端末に記憶されます。
      </p>

      <div className="master-add">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={3650}
          value={days}
          onChange={onChange}
        />
        <span className="hint">日以内</span>
      </div>

      {saved && <p className="master-status">保存しました（{days}日）</p>}
    </section>
  );
}

function GtinMasterSection() {
  const [status, setStatus] = useState<GtinMasterStatus>(gtinMasterStatus());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadGtinMaster()
      .then(setStatus)
      .catch(() => {});
  }, []);

  async function reload() {
    setBusy(true);
    try {
      setStatus(await loadGtinMaster(true));
    } catch {
      alert('公式マスターの読み込みに失敗しました');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="master">
      <h3>公式GTINマスター</h3>
      <p className="hint">
        医薬品の公式コード表（GTIN↔販売名）。スキャンしたGS1コードから薬品名を自動表示します。
        端末内に保持し、クラウドへは送信しません。
      </p>
      <p className="master-status">
        状態:{' '}
        {status.loaded
          ? `読込済み ${status.count.toLocaleString()}件${status.version ? `（${status.version}版）` : ''}`
          : busy
            ? '読込中…'
            : '未読込'}
      </p>
      <button type="button" onClick={reload} disabled={busy}>
        {busy ? '読込中…' : '再読込'}
      </button>
    </section>
  );
}

function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function doExport() {
    setBusy(true);
    try {
      await exportBackup();
    } catch {
      alert('書き出しに失敗しました');
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // 同じファイルを連続で選べるよう値をリセット
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const r = await importBackup(file);
      alert(`復元しました: 処方箋 ${r.prescriptions}件 / 調剤者 ${r.dispensers}件 / 薬品 ${r.drugs}件`);
    } catch {
      alert('読み込みに失敗しました');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="master">
      <h3>データのバックアップ</h3>
      <p className="hint">
        端末内のファイルに保存／復元します。クラウドには送信しません。
        ブラウザのデータ消去や端末の故障に備えて、ときどき書き出して保管してください。
      </p>

      <div className="backup-actions">
        <button type="button" className="primary" onClick={doExport} disabled={busy}>
          バックアップを書き出し
        </button>
        <label className="backup-file-label">
          バックアップを読み込み
          <input
            ref={fileRef}
            className="backup-file-input"
            type="file"
            accept="application/json,.json"
            onChange={onFile}
            disabled={busy}
          />
        </label>
      </div>

      {busy && <p className="backup-busy">処理中です…</p>}
    </section>
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

      <DrugBulkImport />
    </section>
  );
}

function DrugBulkImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // 同じファイルを連続で選べるよう値をリセット
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const isJson =
        file.name.toLowerCase().endsWith('.json') ||
        /^\s*[[{]/.test(text);
      const r = isJson ? await importDrugsJson(text) : await importDrugsCsv(text);
      alert(`取込: 追加 ${r.added}件 / スキップ ${r.skipped}件`);
    } catch {
      alert('取込に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  async function doExport() {
    setBusy(true);
    try {
      await exportDrugsCsv();
    } catch {
      alert('書き出しに失敗しました');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="drug-bulk">
      <p className="hint">
        手元の一覧をまとめて取り込めます。CSVは1行1件「GTIN,薬品名」（先頭のヘッダ行は自動で無視）。
        JSONも読み込めます。端末内のファイルのみを扱い、クラウドには送信しません。
      </p>
      <div className="drug-bulk-actions">
        <label className="drug-bulk-file-label">
          ファイルから取込（CSV / JSON）
          <input
            ref={fileRef}
            className="drug-bulk-file-input"
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={onFile}
            disabled={busy}
          />
        </label>
        <button type="button" onClick={doExport} disabled={busy}>
          CSVで書き出し
        </button>
      </div>
      {busy && <p className="backup-busy">処理中です…</p>}
    </div>
  );
}
