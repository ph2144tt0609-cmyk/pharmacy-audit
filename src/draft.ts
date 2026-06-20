// 新規作成中の処方箋を localStorage へ自動保存し、再読込/クラッシュ後に復元するための下書き機構。
// 写真（weighPhoto: Blob）は localStorage に保存できないため、テキスト項目のみを対象とする。

// Item からテキスト項目だけを取り出した下書き用の型（weighPhoto / weighPhotoMime を除く）
export interface DraftItem {
  id: string;
  drugName?: string;
  gtin?: string;
  lot?: string;
  expiry?: string;
  serial?: string;
  grams?: string;
  gs1Raw?: string;
}

export interface Draft {
  number: string;
  operator: string;
  items: DraftItem[];
  savedAt: string; // ISO 8601 文字列
}

// localStorage のキー
const DRAFT_KEY = 'pa.draft';

// 下書きを保存する。書き込みに失敗（容量超過・プライベートモード等）しても呼び出し側を壊さない。
export function saveDraft(d: Draft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // localStorage が使えない／容量超過などは黙って無視（入力自体は継続させる）
  }
}

// 下書きを読み込む。無い・壊れている・型が想定外なら null を返す。
export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidDraft(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// 下書きを削除する。
export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // 無視
  }
}

// 下書きに「意味のある入力」が含まれているか。
// number / operator のいずれか、または item のテキスト項目のいずれかが非空なら true。
// 空の下書きは保存も復元提示もしない。
export function isDraftMeaningful(d: Draft): boolean {
  if (nonEmpty(d.number) || nonEmpty(d.operator)) return true;
  return d.items.some(
    (it) =>
      nonEmpty(it.drugName) ||
      nonEmpty(it.gtin) ||
      nonEmpty(it.lot) ||
      nonEmpty(it.expiry) ||
      nonEmpty(it.serial) ||
      nonEmpty(it.grams) ||
      nonEmpty(it.gs1Raw),
  );
}

function nonEmpty(s: string | undefined): boolean {
  return typeof s === 'string' && s.trim() !== '';
}

// JSON.parse 結果が Draft として妥当かの軽い検証（最低限の構造チェック）。
function isValidDraft(v: unknown): v is Draft {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Record<string, unknown>;
  if (typeof d.number !== 'string') return false;
  if (typeof d.operator !== 'string') return false;
  if (typeof d.savedAt !== 'string') return false;
  if (!Array.isArray(d.items)) return false;
  return d.items.every(
    (it) => typeof it === 'object' && it !== null && typeof (it as Record<string, unknown>).id === 'string',
  );
}
