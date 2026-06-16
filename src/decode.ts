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

export async function decodeFromFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const result = await reader.decodeFromImageUrl(url);
    return result.getText();
  } finally {
    URL.revokeObjectURL(url);
  }
}
