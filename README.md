# Config Layer

複数の Obsidian Vault で CSS・ホットキー・コミュニティプラグインを共通化するためのプラグイン。
デスクトップ版 Obsidian で使用する。

## 1. インストール

本体を `~/workspace` に置いてビルドする。

```bash
mkdir -p ~/workspace
git clone https://github.com/takashit16833/obsidian-config-layer.git ~/workspace/obsidian-config-layer
cd ~/workspace/obsidian-config-layer
npm install
npm run build
```

各 Vault から `main.js` と `manifest.json` をシンボリックリンクで参照する。
`VAULT` は実際の Vault のパスに置き換える。

```bash
VAULT="/path/to/Vault"
PLUGIN="$VAULT/.obsidian/plugins/config-layer"

mkdir -p "$PLUGIN"
ln -s "$HOME/workspace/obsidian-config-layer/main.js" "$PLUGIN/main.js"
ln -s "$HOME/workspace/obsidian-config-layer/manifest.json" "$PLUGIN/manifest.json"
```

フォルダ全体はリンクしない。Vault ごとの設定（`data.json`）を独立して保持するため。

Obsidian を再起動し、「設定 → コミュニティプラグイン」で Config Layer を有効化する。

## 2. 共通設定を用意する

共通設定は `~/dotfiles/obsidian/` に置く。

```text
~/dotfiles/obsidian/
├── hotkeys.json
├── plugins.json
└── css/
    ├── common.css
    └── ...
```

- `css/*.css`：共通で使う CSS。
- `hotkeys.json`：共通ホットキー。Obsidian の `hotkeys.json` と同じ形式。
- `plugins.json`：各 Vault に入れておきたいプラグインの ID 一覧（省略可）。

`plugins.json` の記述例：

```json
[
  "another-quick-switcher",
  "tab-shifter"
]
```

## 3. Vault ごとに設定する

Obsidian の「設定 → Config Layer」で次のように指定する。

| 項目 | 設定値 |
| --- | --- |
| CSS folder | `~/dotfiles/obsidian/css` |
| Hotkeys folder | `~/dotfiles/obsidian` |
| Plugins folder | 空欄（Hotkeys folder を使用） |
| Watch external files | ON（共通ファイルの変更を自動反映） |

設定後に行うこと：

1. **Shared CSS** で使いたい CSS を ON にする。ON/OFF は Vault ごとに保存される。
2. **Apply shared hotkeys** の **Apply** を押す。
3. `plugins.json` を使う場合は **Apply required plugins** の **Apply** を押す。

### ローカル画像を CSS で使う

共通 CSS からホームディレクトリ内の画像を参照する場合は、次のように書く。

```css
:root {
  --rhb-wallpaper-image: url("~/Pictures/wallpaper.jpg");
}
```

Config Layer が `~/` を実際のホームディレクトリに展開し、画像を CSS に埋め込んで表示する。PNG、JPEG、GIF、WebP、AVIF、SVG、BMP、ICO に対応。従来の HTTP(S) URL はそのまま使える。

CSS を変更した場合は従来どおり自動反映される。**画像ファイル自体を変更した場合**は、コマンドパレットの **Config Layer: Refresh shared configuration** を実行して再読み込みする。画像が見つからない場合や未対応形式の場合は画像を表示せず、開発者コンソールへ警告を出す。

## 4. 普段の使い方

共通ファイルを編集すれば、**Watch external files** が ON の場合は自動で反映される。

- **CSS**：有効にしたファイルの変更が表示に反映される。新しいファイルが一覧に出ない場合は **Refresh CSS files** を押す。
- **ホットキー**：共通設定と同じコマンドは共通側が優先される。それ以外の Vault 固有設定は残る。共通側から削除すると、元の Vault 固有設定があれば復元される（Vault 側で独自変更した値は保護される）。
- **プラグイン**：`plugins.json` にある未導入のプラグインをインストールし、無効なら有効化する。一覧から削除してもアンインストールや無効化はしない。各プラグインの設定は共通化しない。

自動反映を OFF にしている場合は、設定画面の **Refresh** / **Apply** ボタンで手動反映する。
