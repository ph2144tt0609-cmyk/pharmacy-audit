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
 * 写真(File)からGS1コードを読み取る。
 *
 * 実機の課題は2つ:
 *  1) 大きな写真の中にコードが小さく写る → 中央を段階的に切り出して拡大する
 *  2) 医薬品ボトルのバーコードは「縦向き(90°回転)」で印字されていることがある
 *     → 横向き前提の1次元バーコード読取では読めないため、0/90/270°回転も試す
 *     （DataMatrix/QRは回転不変なので0°で読めるが、回転は1次元コード対策）
 */
export async function decodeFromFile(file: File): Promise<string> {
  const img = await loadImage(file);
  const text = decodeFromSource(img, img.naturalWidth, img.naturalHeight, [1, 0.6, 0.4], [0, 90, 270], 1500);
  if (text) return text;
  throw new Error('decode failed');
}

/**
 * 動画フレームから1回だけ読み取りを試す（ライブスキャン用・軽量）。
 * 連続で呼ばれるので試行回数を絞る：全体＋中央のみ、0°と90°のみ。
 * （90°で縦向き1次元バーコードに対応。1次元の読取は左右両方向を見るため270°は省略）
 */
export function decodeFromVideoFrame(video: HTMLVideoElement): string | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  return decodeFromSource(video, w, h, [1, 0.6], [0, 90], 1200);
}

/** 領域(中央比率)×回転 を順に試し、最初に読めたテキストを返す。 */
function decodeFromSource(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  fractions: number[],
  rotations: number[],
  target: number,
): string | null {
  const crops = fractions.map((f) => cropAndScale(source, srcW, srcH, f, target));
  for (const rot of rotations) {
    for (const base of crops) {
      const canvas = rot === 0 ? base : rotateCanvas(base, rot);
      const text = tryDecode(canvas);
      if (text) return text;
    }
  }
  return null;
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
 * source の中央を frac 比率で切り出し、最大辺が target px 程度になるよう拡大する。
 * source は画像/動画/canvas いずれも可。
 */
function cropAndScale(
  source: CanvasImageSource,
  w: number,
  h: number,
  frac: number,
  target: number,
): HTMLCanvasElement {
  const cw = Math.max(1, Math.round(w * frac));
  const ch = Math.max(1, Math.round(h * frac));
  const sx = Math.round((w - cw) / 2);
  const sy = Math.round((h - ch) / 2);

  const scale = Math.min(3, target / Math.max(cw, ch));
  const dw = Math.max(1, Math.round(cw * scale));
  const dh = Math.max(1, Math.round(ch * scale));

  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, sx, sy, cw, ch, 0, 0, dw, dh);
  return canvas;
}

/** canvas を deg 度(時計回り)回転した新しい canvas を返す。 */
function rotateCanvas(src: HTMLCanvasElement, deg: number): HTMLCanvasElement {
  const swap = deg === 90 || deg === 270;
  const w = swap ? src.height : src.width;
  const h = swap ? src.width : src.height;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(w / 2, h / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
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
