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

export async function ensureSeedData(): Promise<void> {
  // トランザクションで「件数確認→投入」を直列化し、二重投入を防ぐ
  await db.transaction('rw', db.dispensers, async () => {
    const count = await db.dispensers.count();
    if (count === 0) {
      await db.dispensers.bulkAdd(DEFAULT_DISPENSERS.map((name) => ({ name })));
    }
  });
}

// GTIN から薬品名を引く（マスタに無ければ undefined）
export async function lookupDrugName(gtin: string): Promise<string | undefined> {
  const drug = await db.drugs.get(gtin);
  return drug?.name;
}

// 「GTIN + 薬品名」をマスタに学習させる（既存があれば上書き更新）
export async function rememberDrug(gtin: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!gtin || !trimmed) return;
  await db.drugs.put({ gtin, name: trimmed });
}
