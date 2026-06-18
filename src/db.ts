import Dexie, { type EntityTable } from 'dexie';

export interface Item {
  id: string;
  drugName?: string;
  gs1Raw?: string;
  gtin?: string;
  lot?: string;
  expiry?: string;
  serial?: string;
  grams?: string;
  weighPhoto?: Blob;
  weighPhotoMime?: string;
}

export interface Prescription {
  id?: number;
  number: string;
  operator: string; // 調剤者名（旧称: 操作者。内部フィールド名は互換のため維持）
  createdAt: Date;
  items: Item[];
}

// 調剤者マスタ
export interface Dispenser {
  id?: number;
  name: string;
}

// 薬品マスタ（GTIN ↔ 薬品名）
export interface Drug {
  gtin: string;
  name: string;
}

class PharmacyDB extends Dexie {
  prescriptions!: EntityTable<Prescription, 'id'>;
  dispensers!: EntityTable<Dispenser, 'id'>;
  drugs!: EntityTable<Drug, 'gtin'>;

  constructor() {
    super('PharmacyAudit');
    // v1: 初期スキーマ（既存ユーザーのデータ互換のため残す）
    this.version(1).stores({
      prescriptions: '++id, createdAt, number',
    });
    // v2: 調剤者マスタ・薬品マスタを追加
    this.version(2).stores({
      prescriptions: '++id, createdAt, number',
      dispensers: '++id, name',
      drugs: 'gtin, name',
    });
  }
}

export const db = new PharmacyDB();

// 初期データ投入：調剤者マスタが空なら既定の3名を登録する
const DEFAULT_DISPENSERS = ['田中亨', '藤田耕成', '長谷宏子'];

// 緑ヶ丘薬局でよく使う散剤の既定マスタ（GTIN ↔ 薬品名）。
// ネット調査で確定したGTINを順次ここへ追加する。core照合するので、
// 入手しやすい JAN(13桁) でも 調剤包装単位の GTIN(14桁) でも紐づく。
const DEFAULT_DRUGS: Drug[] = [
  // 例: { gtin: '4987XXXXXXXXXX', name: 'カロナール細粒20%' },
];

/**
 * GTIN を「包装段階に依存しない中核キー」に正規化する。
 *
 * 日本の医薬品は同一商品でも調剤包装単位 / 販売包装単位 / 元梱包装単位で
 * GTIN が変わる（先頭の包装識別子と末尾のチェックデジットが変わる）。
 * GTIN-14 の 2〜13桁目（= GTIN-13 の 1〜12桁目）は商品識別の中核で全段階共通なので、
 * ここを取り出して照合すると、登録した番号と読み取った番号の段階が違っても一致できる。
 */
export function gtinKey(raw: string | undefined): string {
  const d = (raw ?? '').replace(/\D/g, '');
  if (d.length === 14) return d.slice(1, 13); // 包装識別子とチェックデジットを除いた12桁
  if (d.length === 13) return d.slice(0, 12); // チェックデジットを除いた12桁
  if (d.length === 12) return d.slice(0, 11).padStart(12, '0');
  return d; // 想定外の長さはそのまま比較
}

export async function ensureSeedData(): Promise<void> {
  // トランザクションで「件数確認→投入」を直列化し、二重投入を防ぐ
  await db.transaction('rw', db.dispensers, async () => {
    const count = await db.dispensers.count();
    if (count === 0) {
      await db.dispensers.bulkAdd(DEFAULT_DISPENSERS.map((name) => ({ name })));
    }
  });

  // 薬品マスタ：既定リストのうち、まだ中核キーが存在しないものだけ追加する
  // （ユーザーが手で直した名前を上書きしないよう、core で重複判定する）
  if (DEFAULT_DRUGS.length === 0) return;
  await db.transaction('rw', db.drugs, async () => {
    const existing = await db.drugs.toArray();
    const have = new Set(existing.map((d) => gtinKey(d.gtin)));
    const toAdd = DEFAULT_DRUGS.filter((d) => {
      const k = gtinKey(d.gtin);
      if (have.has(k)) return false;
      have.add(k);
      return true;
    });
    if (toAdd.length > 0) await db.drugs.bulkPut(toAdd);
  });
}

// GTIN から薬品名を引く（マスタに無ければ undefined）。
// まず完全一致、無ければ中核キー（包装段階を無視した12桁）で照合する。
export async function lookupDrugName(gtin: string): Promise<string | undefined> {
  const exact = await db.drugs.get(gtin);
  if (exact) return exact.name;

  const key = gtinKey(gtin);
  if (!key) return undefined;
  const all = await db.drugs.toArray();
  const hit = all.find((d) => gtinKey(d.gtin) === key);
  return hit?.name;
}

// 「GTIN + 薬品名」をマスタに学習させる（既存があれば上書き更新）
export async function rememberDrug(gtin: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!gtin || !trimmed) return;
  await db.drugs.put({ gtin, name: trimmed });
}
