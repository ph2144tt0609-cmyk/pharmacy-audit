import { useEffect, useRef, useState } from 'react';
import { decodeFromVideoFrame } from '../decode';
import './scanner.css';

interface Props {
  onResult: (text: string) => void;
  onClose: () => void;
}

// torch（ライト）は標準型に無いため拡張
type TorchCaps = MediaTrackCapabilities & { torch?: boolean };

/**
 * ライブカメラでバーコードを連続読み取りする全画面モーダル。
 * 読み取れたら自動でカメラを止めて onResult を呼ぶ（シャッター操作は不要）。
 *
 * 実機で読めない主因への対策:
 *  - 高解像度を要求（端末既定の640×480等だとDataMatrixが潰れて解読不能になる）
 *  - 連続オートフォーカス・ライト（対応端末のみ）
 *  - onResult は ref 経由で参照し、親の再レンダーでカメラを再起動させない
 */
export function CameraScanner({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  // onResult を ref に保持（依存配列に入れずカメラ再起動を防ぐ）
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const [error, setError] = useState<string | null>(null);
  const [resolution, setResolution] = useState<string>('');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function stop() {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }

    function tick() {
      if (doneRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return;
      let text: string | null = null;
      try {
        text = decodeFromVideoFrame(video);
      } catch {
        text = null;
      }
      if (text) {
        doneRef.current = true;
        if (navigator.vibrate) navigator.vibrate(60);
        stop();
        onResultRef.current(text);
      }
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current!;
        video.srcObject = stream;
        video.muted = true;
        video.setAttribute('playsinline', 'true');
        await video.play().catch(() => {});

        const track = stream.getVideoTracks()[0];
        // 連続オートフォーカス（対応端末のみ。未対応は無視）
        try {
          await track.applyConstraints({
            advanced: [{ focusMode: 'continuous' }],
          } as unknown as MediaTrackConstraints);
        } catch {
          /* フォーカス制御未対応 */
        }
        // 実解像度・ライト対応の取得（診断＆機能）
        const settings = track.getSettings();
        if (settings.width && settings.height) {
          setResolution(`${settings.width}×${settings.height}`);
        }
        const caps = (track.getCapabilities?.() ?? {}) as TorchCaps;
        if (caps.torch) setTorchSupported(true);

        timerRef.current = window.setInterval(tick, 300);
      } catch (e) {
        if (!cancelled) setError(cameraErrorMessage(e));
      }
    }

    start();
    return () => {
      cancelled = true;
      stop();
    };
    // onResult は ref 経由のため依存に含めない（再起動防止）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next }],
      } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      /* ライト未対応 */
    }
  }

  return (
    <div className="scanner">
      <div className="scanner-video-wrap">
        <video ref={videoRef} className="scanner-video" playsInline muted autoPlay />
        {!error && <div className="scanner-frame" />}
      </div>
      <div className="scanner-bar">
        {error ? (
          <p className="scanner-error">{error}</p>
        ) : (
          <p className="scanner-hint">
            バーコードを枠の中に。読み取れたら自動で進みます
            {resolution && <span className="scanner-res"> ・{resolution}</span>}
          </p>
        )}
        <div className="scanner-actions">
          {torchSupported && (
            <button type="button" className={torchOn ? 'on' : ''} onClick={toggleTorch}>
              {torchOn ? 'ライト消す' : 'ライト点ける'}
            </button>
          )}
          <button type="button" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

function cameraErrorMessage(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'カメラの使用が許可されていません。設定でカメラを許可するか、「写真から読み取り」をお使いください';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'カメラが見つかりません。「写真から読み取り」をお使いください';
  }
  return 'カメラを起動できませんでした。「写真から読み取り」をお使いください';
}
