// 公式GTINマスター（medhot.medd.jp 由来。GTIN → 販売名）。
// public/gtin-master.txt（タブ区切り・先頭に "#version=YYYYMMDD"）を同一オリジンから取得し、
// 起動時にメモリ(Map)へ読み込む。スキャンしたGTINから薬品名を即時解決する。
// 約13万件をIndexedDBに書かず、メモリ常駐＋HTTPキャッシュで軽快に扱う。
import { gtinKey } from './db';

let exactMap: Map<string, string> | null = null; // GTIN(そのまま) → 販売名
let coreMap: Map<string, string> | null = null; // 中核12桁 → 販売名（保険的フォールバック）
let version = '';
let loading: Promise<GtinMasterStatus> | null = null;

export interface GtinMasterStatus {
  loaded: boolean;
  count: number;
  version: string;
}

export function gtinMasterStatus(): GtinMasterStatus {
  return { loaded: exactMap !== null, count: exactMap?.size ?? 0, version };
}

/**
 * 公式マスターをメモリへ読み込む。既読込なら何もしない（force=trueで再取得）。
 * 取得失敗時は throw する（呼び出し側で握りつぶしてよい＝マスター無しでも動作する）。
 */
export async function loadGtinMaster(force = false): Promise<GtinMasterStatus> {
  if (!force && exactMap) return gtinMasterStatus();
  if (!force && loading) return loading;

  loading = (async () => {
    const url = `${import.meta.env.BASE_URL}gtin-master.txt`;
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`gtin-master fetch failed: ${res.status}`);
    const text = await res.text();

    const exact = new Map<string, string>();
    const core = new Map<string, string>();
    let ver = '';

    for (const raw of text.split('\n')) {
      const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
      if (!line) continue;
      if (line.charCodeAt(0) === 35 /* '#' */) {
        const m = line.match(/version=(\S+)/);
        if (m) ver = m[1];
        continue;
      }
      const tab = line.indexOf('\t');
      if (tab <= 0) continue;
      const gtin = line.slice(0, tab);
      const name = line.slice(tab + 1);
      if (!exact.has(gtin)) exact.set(gtin, name);
      const key = gtinKey(gtin);
      if (key && !core.has(key)) core.set(key, name);
    }

    exactMap = exact;
    coreMap = core;
    version = ver;
    return gtinMasterStatus();
  })();

  try {
    return await loading;
  } finally {
    loading = null;
  }
}

/** スキャンしたGTINから販売名を引く。完全一致 → 中核12桁の順。未読込/該当なしは undefined。 */
export function lookupGtinMaster(gtin: string | undefined): string | undefined {
  if (!gtin || !exactMap) return undefined;
  const hit = exactMap.get(gtin);
  if (hit) return hit;
  const key = gtinKey(gtin);
  if (key && coreMap) return coreMap.get(key);
  return undefined;
}
