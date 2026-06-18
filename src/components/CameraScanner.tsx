import { useEffect, useRef, useState } from 'react';
import { decodeFromVideoFrame } from '../decode';
import './scanner.css';

interface Props {
  onResult: (text: string) => void;
  onClose: () => void;
}

/**
 * ライブカメラでバーコードを連続読み取りする全画面モーダル。
 * 読み取れたら自動でカメラを止めて onResult を呼ぶ（シャッター操作は不要）。
 */
export function CameraScanner({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

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
        onResult(text);
      }
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
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
        timerRef.current = window.setInterval(tick, 350);
      } catch (e) {
        if (!cancelled) setError(cameraErrorMessage(e));
      }
    }

    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [onResult]);

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
          <p className="scanner-hint">バーコードを枠の中に。読み取れたら自動で進みます</p>
        )}
        <button type="button" onClick={onClose}>閉じる</button>
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
