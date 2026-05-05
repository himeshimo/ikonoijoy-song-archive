# イコノイジョイ楽曲アーカイブ

イコノイジョイ（=LOVE / ≠ME / ≒JOY）の楽曲・作品・クリエイター・コール(MIX)を横断して探せる、静的SPAです。

## 公開URL（GitHub Pages）

公開後: `https://himeshimo.github.io/ikonoijoy-song-archive/`

## ローカル起動

```bash
cd /Users/r.hassy2nd/Documents/Codex/2026-05-04/files-mentioned-by-the-user-injdb
python3 -m http.server 8080
```

ブラウザで:

- `http://localhost:8080/index.html?view=home`

## 主要ルート

- `?view=home` トップ
- `?view=releases` 作品
- `?release=xxx` 作品詳細
- `?view=creators` クリエイター
- `?view=calls` コール(MIX)
- `?id=xxx` 楽曲詳細
- `?id=xxx#call` 楽曲詳細（コール位置）

## ファイル構成

- `index.html` SPA本体
- `app.js` ルーティング・表示ロジック
- `styles.css` UI（ダークテーマ）
- `data.js` 楽曲データ
- `normalized_catalog.csv` 正規化済みCSV

## 注意
- `まだ制作段階のため、情報の正確性に欠ける部分があります。あらかじめご了承ください。
