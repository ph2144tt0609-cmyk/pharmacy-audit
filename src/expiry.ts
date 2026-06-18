// 有効期限(expiry)の解釈と期限切れ/間近の判定
// 対応形式: YYYY-MM-DD / YYYY-MM-末 / YYYY-MM
// 日が「末」/「00」/欠落のときは、その月の月末日として扱う。

/** 「期限間近」とみなす既定の日数（今日からX日以内）。 */
export const DEFAULT_SOON_DAYS = 180;

/** 後方互換のため残置。判定には getSoonDays() の現在値を使う。 */
export const SOON_DAYS = DEFAULT_SOON_DAYS;

const SOON_DAYS_KEY = 'pa.soonDays';

/** 1〜3650 にクランプして整数化する。 */
function clampSoonDays(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SOON_DAYS;
  const i = Math.round(n);
  if (i < 1) return 1;
  if (i > 3650) return 3650;
  return i;
}

/** localStorage から初期値を読む。無効・未保存なら既定値。 */
function loadSoonDays(): number {
  try {
    const raw = localStorage.getItem(SOON_DAYS_KEY);
    if (raw == null) return DEFAULT_SOON_DAYS;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_SOON_DAYS;
    return clampSoonDays(n);
  } catch {
    return DEFAULT_SOON_DAYS;
  }
}

// 現在の閾値（モジュール内部で保持）。
let soonDays = loadSoonDays();

/** 現在の「期限間近」とみなす日数を返す。 */
export function getSoonDays(): number {
  return soonDays;
}

/**
 * 「期限間近」とみなす日数を設定する。
 * 1〜3650 にクランプし、localStorage へ保存してモジュール変数を更新する。
 * クランプ後の実際の値を返す。
 */
export function setSoonDays(n: number): number {
  const v = clampSoonDays(n);
  soonDays = v;
  try {
    localStorage.setItem(SOON_DAYS_KEY, String(v));
  } catch {
    // 保存できなくても現在値の更新は維持する
  }
  return v;
}

export type ExpiryStatus = 'expired' | 'soon' | 'ok' | 'unknown';

/** 指定年月の月末日(1〜31)を返す。month は 1〜12。 */
function lastDayOfMonth(year: number, month: number): number {
  // 翌月の0日 = 当月の末日
  return new Date(year, month, 0).getDate();
}

/**
 * 有効期限文字列を Date(その日の0時)に解釈する。
 * 解釈できない・空のときは null。
 */
export function parseExpiry(s: string | undefined): Date | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;

  // 区切りは - / . いずれも許容
  const m = trimmed.match(
    /^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}|末|00))?$/,
  );
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;

  const dayPart = m[3];
  let day: number;
  if (dayPart === undefined || dayPart === '末' || dayPart === '00') {
    // 日が欠落・末・00 → 月末日
    day = lastDayOfMonth(year, month);
  } else {
    const d = Number(dayPart);
    if (d < 1 || d > lastDayOfMonth(year, month)) return null;
    day = d;
  }

  return new Date(year, month - 1, day);
}

/** 日付の時刻を切り落として0時にする。 */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * 期限切れ/間近を判定する。
 * 月末日 < 今日 → expired、現在の soonDays 日以内 → soon、それ以外 ok、
 * 解釈不能/空 → unknown。
 */
export function expiryStatus(
  s: string | undefined,
  now: Date = new Date(),
): ExpiryStatus {
  const exp = parseExpiry(s);
  if (!exp) return 'unknown';

  const today = startOfDay(now);
  const expDay = startOfDay(exp);

  if (expDay < today) return 'expired';

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((expDay.getTime() - today.getTime()) / msPerDay);
  if (diffDays <= soonDays) return 'soon';

  return 'ok';
}
