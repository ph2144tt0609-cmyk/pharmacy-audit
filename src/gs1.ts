const FNC1 = '\x1d';

type AISpec = { name: string; len?: number };

const FIXED: Record<string, AISpec> = {
  '00': { name: 'SSCC', len: 18 },
  '01': { name: 'GTIN', len: 14 },
  '02': { name: 'GTIN(含有)', len: 14 },
  '11': { name: '製造日', len: 6 },
  '13': { name: '包装日', len: 6 },
  '15': { name: '賞味期限', len: 6 },
  '17': { name: '有効期限', len: 6 },
};

const VARIABLE: Record<string, AISpec> = {
  '10': { name: 'ロット' },
  '21': { name: 'シリアル' },
  '22': { name: '消費者向けID' },
  '240': { name: '追加ID' },
  '241': { name: '顧客部品番号' },
  '250': { name: '副シリアル' },
  '30': { name: '数量' },
  '37': { name: '入数' },
};

export interface ParsedGS1 {
  gtin?: string;
  lot?: string;
  expiry?: string;
  serial?: string;
  extras: Record<string, string>;
  raw: string;
}

export function parseGS1(input: string): ParsedGS1 {
  let s = stripSymbology(input);
  if (s.startsWith(FNC1)) s = s.slice(1);

  const out: ParsedGS1 = { extras: {}, raw: input };
  let i = 0;

  while (i < s.length) {
    const ai2 = s.slice(i, i + 2);
    const ai3 = s.slice(i, i + 3);

    let ai: string | undefined;
    let spec: AISpec | undefined;
    if (FIXED[ai2]) { ai = ai2; spec = FIXED[ai2]; }
    else if (VARIABLE[ai2]) { ai = ai2; spec = VARIABLE[ai2]; }
    else if (VARIABLE[ai3]) { ai = ai3; spec = VARIABLE[ai3]; }
    else break;

    i += ai.length;
    let value: string;

    if (spec.len !== undefined) {
      value = s.slice(i, i + spec.len);
      i += spec.len;
    } else {
      const end = s.indexOf(FNC1, i);
      if (end === -1) { value = s.slice(i); i = s.length; }
      else { value = s.slice(i, end); i = end + 1; }
    }

    switch (ai) {
      case '01': out.gtin = value; break;
      case '10': out.lot = value; break;
      case '17': out.expiry = formatExpiry(value); break;
      case '21': out.serial = value; break;
      default: out.extras[`${ai}(${spec.name})`] = ai === '17' || ai === '11' || ai === '15' ? formatExpiry(value) : value;
    }
  }

  return out;
}

function stripSymbology(s: string): string {
  if (s.startsWith(']C1') || s.startsWith(']d2') || s.startsWith(']e0')) return s.slice(3);
  return s;
}

function formatExpiry(yymmdd: string): string {
  if (yymmdd.length !== 6) return yymmdd;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const yyyy = yy >= 50 ? 1900 + yy : 2000 + yy;
  const day = dd === '00' ? '末' : dd;
  return `${yyyy}-${mm}-${day}`;
}
