import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

const hints = new Map<DecodeHintType, unknown>();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.CODE_128,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.EAN_13,
]);
hints.set(DecodeHintType.TRY_HARDER, true);
hints.set(DecodeHintType.ASSUME_GS1, true);

const reader = new BrowserMultiFormatReader(hints);

/**
 * 写真からGS1コードを読み取る。
 * スマホ写真は「大きな画像の中に小さなコード」になりがちで、画像全体を一度
 * 読むだけでは失敗しやすい。そこで中央を段階的に切り出して拡大し、複数回
 * 読み取りを試す（粉薬ボトルの小さな・曲面のコード対策）。
 */
export async function decodeFromFile(file: File): Promise<string> {
  const img = await loadImage(file);

  // 試す領域（中央比率）。コードは中央に置かれることが多いので段階的に拡大する。
  const fractions = [1, 0.7, 0.5, 0.35, 0.25];
  for (const frac of fractions) {
    const canvas = cropAndScale(img, frac, 1500);
    const text = tryDecode(canvas);
    if (text) return text;
  }
  throw new Error('decode failed');
}

function tryDecode(canvas: HTMLCanvasElement): string | null {
  try {
    const result = reader.decodeFromCanvas(canvas);
    return result?.getText() ?? null;
  } catch {
    return null;
  }
}

/**
 * 画像の中央を frac 比率で切り出し、最大辺が target px 程度になるよう拡大する。
 * 小さく写ったコードを拡大して判読しやすくする。
 */
function cropAndScale(img: HTMLImageElement, frac: number, target: number): HTMLCanvasElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const cw = Math.max(1, Math.round(w * frac));
  const ch = Math.max(1, Math.round(h * frac));
  const sx = Math.round((w - cw) / 2);
  const sy = Math.round((h - ch) / 2);

  // 拡大は最大3倍まで。大きすぎる画像は縮小して扱いやすくする。
  const scale = Math.min(3, target / Math.max(cw, ch));
  const dw = Math.max(1, Math.round(cw * scale));
  const dh = Math.max(1, Math.round(ch * scale));

  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, cw, ch, 0, 0, dw, dh);
  return canvas;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
