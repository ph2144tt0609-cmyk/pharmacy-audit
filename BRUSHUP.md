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
- [ ] PWA化（manifest + service worker、オフライン動作・ホーム画面追加最適化。※PNGアイコンが要・現状はSVGのみ）
- [ ] 入力下書きの自動保存（誤操作・離脱対策）
- [ ] 印刷: GS1コード写真の任意添付（薬局名ヘッダー・監査者確認欄は実装済み）
- [ ] カメラ読取がまだ不十分な場合の代替（@zxing decodeFromConstraints へ置換／タップフォーカス等）

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
  - カメラ読取の改善（「読み取れない」対応）: 高解像度要求(1920×1080)・連続オートフォーカス・ライト(トーチ)トグル・実解像度の画面表示を追加。`onResult`をref化し`useEffect([])`で親再レンダー時のカメラ再起動を防止。ライブ解読は中央寄り(0.5)＋target1400に調整。`CameraScanner.tsx` + `scanner.css` + `decode.ts`。※実機カメラ検証は要ユーザー（プレビューはカメラ無しでgraceful エラーを確認）。
  - 公式GTINマスター取込（medhot.medd.jp の医薬品コード表）。GTIN→販売名 約12.9万件を `public/gtin-master.txt`（タブ区切り・7.6MB）に同梱し、起動時にメモリ(Map)へ読込→スキャン即・薬品名自動表示。`gtinMaster.ts` + `App.tsx`(起動時load) + `PrescriptionEditor.tsx`(マスター併用lookup) + `Settings.tsx`(状態表示/再読込)。dev検証で128,994件・20260531版の読込を確認。**月1更新手順**: medhot から `A_YYYYMMDD_1.txt`/`_2.txt`(SJIS) を取得→file1[販売名=4列,調剤=30列]/file2[調剤=30,販売=33,元梱=34列]を `gtin<TAB>名` に整形→`public/gtin-master.txt` を差替え(#version更新)→`npm run deploy`。
- 2026-06-18 第3イテレーション（デプロイ手動モード・承認後にデプロイ＆main同期）:
  - 印刷ヘッダー／監査者確認欄追加（最上部「緑ヶ丘薬局（株式会社しずく）」・最下部に署名欄＋確認印枠）。`PrintView.tsx` + `printview-extra.css`。※件数が非常に多い処方ではA4 1枚に収まるか要確認。
  - 有効期限「間近」しきい値を設定画面から変更可能に（1〜3650日・既定180・localStorage `pa.soonDays`）。`expiry.ts`(getSoonDays/setSoonDays、expiryStatusのシグネチャは不変) + `Settings.tsx`。
  - g数の妥当性チェック＋単位「g」表示（非数値/0以下は警告のみ・保存はブロックしない）。`PrescriptionEditor.tsx` + `editor-extra.css`。
  - 上記を含む作業ツリー全体を本デプロイで公開し、mainにもコミットして公開サイトと同期。
- 運用メモ: 自動ループは「デプロイ手動」モードで稼働中（cron `7 * * * *`, session-only）。各イテレーションは実装＋ビルド検証まで自動、`npm run deploy`はユーザー承認後のみ。
