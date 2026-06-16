# 調剤監査 (Pharmacy Audit)

スマホで処方箋ごとに GS1 コード読み取り + 秤量写真をまとめて記録し、AirPrint で 1 枚に印刷する Web アプリ。

- データは端末ローカルの IndexedDB に保存 (オフライン動作)
- GS1-128 / DataMatrix / QR をカメラで撮影してデコード
- iOS Safari からそのまま `window.print()` → AirPrint
- ホスティングは GitHub Pages を想定 (HTTPS 必須)

## ローカルで動かす

```sh
npm install
npm run dev
```

`http://localhost:5173/` で開きます。同じ Wi-Fi の iPhone から見るには `npm run dev -- --host` を指定し、`https` 化が必要な場合は `mkcert` 等で証明書を入れてください。

## GitHub Pages にデプロイ

1. GitHub で新規リポジトリを作成 (例: `pharmacy-audit`)
2. このフォルダを `git init` → `git remote add origin ...` → `git push -u origin main`
3. リポジトリ Settings → Pages → **Source: GitHub Actions** を選択
4. `main` に push すると `.github/workflows/deploy.yml` が走り、`https://<user>.github.io/<repo>/` で公開

> リポジトリ名が `pharmacy-audit` 以外の場合、`vite.config.ts` の `base` を自分で設定するか、`GITHUB_PAGES_BASE` 環境変数を使ってください。ワークフローはリポジトリ名から自動で設定します。

## iPhone から使う

1. デプロイ先 URL を Safari で開く
2. 共有メニュー → 「ホーム画面に追加」でアイコン化
3. カメラ起動・印刷(AirPrint)はすべてブラウザ標準機能

## 印刷

「保存」後に表示されるプレビュー画面の「印刷 (AirPrint)」ボタンを押すと iOS の標準印刷ダイアログが開きます。プリンタを選んで 1 枚出力されます。
