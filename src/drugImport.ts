import { db } from './db';

/**
 * 薬品マスタの一括取込・書き出し。
 * すべて端末内で完結する。クラウドへ送信しない。
 */

interface ImportResult {
  added: number;
  skipped: number;
}

// 「GTIN,薬品名」CSV 1行を分解する。
// 先頭フィールドはGTIN（数字想定）、2番目以降を薬品名とみなす（名前中のカンマも拾う）。
// ダブルクォート囲み・前後空白・CRLF を許容する。
function parseCsvLine(line: string): { gtin: string; name: string } | null {
  const raw = line.replace(/\r$/, '');
  if (raw.trim() === '') return null;

  const comma = raw.indexOf(',');
  if (comma < 0) return null;

  const gtinPart = raw.slice(0, comma);
  const namePart = raw.slice(comma + 1);

  const gtin = unquote(gtinPart).trim();
  const name = unquote(namePart).trim();
  if (!gtin || !name) return null;
  return { gtin, name };
}

// 前後の空白を除き、ダブルクォート囲みなら外して中の "" を " に戻す。
function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/""/g, '"');
  }
  return t;
}

// 先頭行がヘッダ（gtin,name / GTIN,薬品名 など）かどうか。
function isHeaderLine(line: string): boolean {
  const first = unquote((line.replace(/\r$/, '').split(',')[0] ?? '')).trim().toLowerCase();
  return first === 'gtin';
}

/**
 * CSV（1行1件「GTIN,薬品名」）を取り込む。
 * 先頭行がヘッダならスキップ。空行・両フィールドが揃わない行はスキップ。
 */
export async function importDrugsCsv(text: string): Promise<ImportResult> {
  const lines = text.split('\n');
  let added = 0;
  let skipped = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.replace(/\r$/, '').trim() === '') continue; // 空行は黙って飛ばす
    if (i === 0 && isHeaderLine(line)) continue; // 先頭ヘッダ行
    const parsed = parseCsvLine(line);
    if (!parsed) {
      skipped++;
      continue;
    }
    await db.drugs.put({ gtin: parsed.gtin, name: parsed.name });
    added++;
  }

  return { added, skipped };
}

/**
 * JSON を取り込む。受理する形:
 *  - [{gtin,name}, ...]
 *  - {drugs:[{gtin,name}, ...]}
 *  - {app:'pharmacy-audit', drugs:[...]}（アプリのバックアップ形式）
 * gtin/name が欠ける要素はスキップ。
 */
export async function importDrugsJson(text: string): Promise<ImportResult> {
  const data = JSON.parse(text);
  const list: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { drugs?: unknown }).drugs)
      ? ((data as { drugs: unknown[] }).drugs)
      : [];

  let added = 0;
  let skipped = 0;

  for (const entry of list) {
    if (entry === null || typeof entry !== 'object') {
      skipped++;
      continue;
    }
    const rec = entry as { gtin?: unknown; name?: unknown };
    const gtin = typeof rec.gtin === 'string' ? rec.gtin.trim() : '';
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    if (!gtin || !name) {
      skipped++;
      continue;
    }
    await db.drugs.put({ gtin, name });
    added++;
  }

  return { added, skipped };
}

// CSV用にフィールドをエスケープ（カンマ・引用符・改行を含むならダブルクォート囲み）。
function csvField(s: string): string {
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ローカル日付の YYYYMMDD。
function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * 現在の薬品マスタを「GTIN,薬品名」CSV（先頭にヘッダ gtin,name）で書き出し、
 * pharmacy-drugs-YYYYMMDD.csv としてダウンロードする。
 */
export async function exportDrugsCsv(): Promise<void> {
  const drugs = await db.drugs.orderBy('name').toArray();
  const lines = ['gtin,name'];
  for (const d of drugs) {
    lines.push(`${csvField(d.gtin)},${csvField(d.name)}`);
  }
  // Excel等で文字化けしないよう BOM を付ける
  const blob = new Blob(['﻿' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy-drugs-${todayStamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
