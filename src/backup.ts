import { db } from './db';
import type { Prescription, Dispenser, Drug, Item } from './db';

// バックアップJSONの構造。weighPhoto(Blob)はJSONに乗らないため
// item から外し、base64データURL文字列を別キー(weighPhotoDataUrl)に持たせる。
type SerializedItem = Omit<Item, 'weighPhoto'> & { weighPhotoDataUrl?: string };
type SerializedPrescription = Omit<Prescription, 'items'> & { items: SerializedItem[] };

interface BackupFile {
  app: 'pharmacy-audit';
  version: 1;
  exportedAt: string;
  prescriptions: SerializedPrescription[];
  dispensers: Dispenser[];
  drugs: Drug[];
}

// Blob → base64データURL文字列
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ローカル日付を YYYYMMDD で返す
function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * 全データ（処方箋・調剤者・薬品）をJSONファイルとして端末にダウンロードする。
 * weighPhoto(Blob) は base64データURL に変換して埋め込む。クラウドへは送信しない。
 */
export async function exportBackup(): Promise<void> {
  const [prescriptions, dispensers, drugs] = await Promise.all([
    db.prescriptions.toArray(),
    db.dispensers.toArray(),
    db.drugs.toArray(),
  ]);

  const serializedPrescriptions: SerializedPrescription[] = await Promise.all(
    prescriptions.map(async (p) => {
      const items: SerializedItem[] = await Promise.all(
        p.items.map(async (item) => {
          const { weighPhoto, ...rest } = item;
          const serialized: SerializedItem = { ...rest };
          if (weighPhoto) {
            serialized.weighPhotoDataUrl = await blobToDataUrl(weighPhoto);
          }
          return serialized;
        }),
      );
      return { ...p, items };
    }),
  );

  const backup: BackupFile = {
    app: 'pharmacy-audit',
    version: 1,
    exportedAt: new Date().toISOString(),
    prescriptions: serializedPrescriptions,
    dispensers,
    drugs,
  };

  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmacy-audit-backup-${todayYmd()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * バックアップJSONファイルを読み込み、IndexedDBへ復元する（キーで上書きマージ）。
 * weighPhotoDataUrl は Blob に戻して weighPhoto に格納する。
 * 取り込んだ件数を返す。検証失敗やパース失敗は throw する。
 */
export async function importBackup(
  file: File,
): Promise<{ prescriptions: number; dispensers: number; drugs: number }> {
  const text = await file.text();
  const data = JSON.parse(text) as Partial<BackupFile>;

  if (data.app !== 'pharmacy-audit') {
    throw new Error('このファイルは散剤監査アプリのバックアップではありません');
  }

  const rawPrescriptions = Array.isArray(data.prescriptions) ? data.prescriptions : [];
  const dispensers = Array.isArray(data.dispensers) ? data.dispensers : [];
  const drugs = Array.isArray(data.drugs) ? data.drugs : [];

  // base64データURL → Blob に戻す
  const prescriptions: Prescription[] = await Promise.all(
    rawPrescriptions.map(async (p) => {
      const items: Item[] = await Promise.all(
        (p.items ?? []).map(async (item) => {
          const { weighPhotoDataUrl, ...rest } = item;
          const restored: Item = { ...rest };
          if (weighPhotoDataUrl) {
            restored.weighPhoto = await (await fetch(weighPhotoDataUrl)).blob();
          }
          return restored;
        }),
      );
      // createdAt はJSONで文字列化されているため Date に戻す
      return { ...p, createdAt: new Date(p.createdAt), items } as Prescription;
    }),
  );

  if (prescriptions.length > 0) await db.prescriptions.bulkPut(prescriptions);
  if (dispensers.length > 0) await db.dispensers.bulkPut(dispensers);
  if (drugs.length > 0) await db.drugs.bulkPut(drugs);

  return {
    prescriptions: prescriptions.length,
    dispensers: dispensers.length,
    drugs: drugs.length,
  };
}
