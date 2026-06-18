# 散剤監査アプリ ブラッシュアップ台帳

このファイルは「1時間ごと自動ブラッシュアップ」の継続性のための台帳。
各イテレーションで未着手バックログから1〜3個選んで実装し、done に移す（done済みは繰り返さない）。

## プロジェクト概要
- 場所: `C:\dev\pharmacy-audit`（Googleドライブ外）
- 公開: https://ph2144tt0609-cmyk.github.io/pharmacy-audit/ （`npm run deploy` = build + gh-pages）
- Stack: Vite8 + React19 + TS6 + Dexie(IndexedDB) + @zxing(GS1写真デコード)
- 制約: **ローカル限定**（クラウド同期/認証/多人数機能は追加しない）・iOS Safari対象・印刷はAirPrint A4 1枚・個人情報は外部送信しない

## 進め方
1. バックログから価値の高い項目を選ぶ
2. チームエージェントで**ファイルが衝突しないよう**分担実装（各エージェントは別ファイル担当、共有のApp.cssは原則メインが管理）
3. `npx tsc -b` で型検証 → エラー修正
4. ビルドが通り低リスク（追加的）なら `npm run deploy`、リスク高なら保留して報告
5. この台帳の done を更新

## バックログ（優先度順）
- [ ] PWA化（manifest + service worker、オフライン動作・ホーム画面追加最適化）
- [ ] 印刷レイアウト改善（薬局名ヘッダー・GS1コード写真の任意添付）
- [ ] 入力下書きの自動保存（誤操作・離脱対策）
- [ ] g数の妥当性チェック・単位補助
- [ ] 有効期限のしきい値（SOON_DAYS=180）を設定画面から変更可能に（任意）

## done（実施履歴）
- 2026-06-18 第1イテレーション（デプロイ済み）:
  - GS1照合を「完全一致」→「中核12桁照合」に修正（包装段階違いでも紐づく）。`db.ts`
  - GS1読取フィールド（GTIN/ロット/有効期限/シリアル）を手動編集・手動入力可に。`PrescriptionEditor.tsx` + `editor-extra.css`
  - データのバックアップ（JSON書き出し/読み込み、写真Blobもbase64で保持）。`backup.ts` + `Settings.tsx` + `settings-extra.css`
  - 処方箋の削除（一覧から確認ダイアログ付き）。`PrescriptionList.tsx`
- 2026-06-18 第2イテレーション（デプロイ済み）:
  - 有効期限の警告表示（期限切れ=赤/間近180日=オレンジ）。入力画面・印刷の両方。`expiry.ts` + `PrintView.tsx` + `printview-extra.css` + `PrescriptionEditor.tsx` + `editor-extra.css`
  - 薬品マスタのCSV/JSON一括取込＆CSV書き出し（GTIN,薬品名）。`drugImport.ts` + `Settings.tsx` + `settings-extra.css`
  - 処方箋一覧の検索・絞り込み（番号・調剤者の部分一致／日付範囲／件数表示）。`PrescriptionList.tsx` + `list-extra.css`
- 2026-06-18 自動ループは利用者の指示で一旦停止。以降は手動対応:
  - ライブカメラスキャン追加（シャッター不要・連続読取→自動反映、回転対応で縦バーコード可、写真読取はフォールバックで継続）。`CameraScanner.tsx` + `scanner.css` + `decode.ts`(decodeFromVideoFrame) + `PrescriptionEditor.tsx`
  - これ以前の自動ブラッシュアップ分はデプロイ済みだがmain未コミットだったため、本コミットでmainを公開サイトに同期。
