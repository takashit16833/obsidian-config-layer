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

### Windows で使う場合

Windows 11 の PowerShell でも同じリポジトリをビルドできます（Node.js と Git が必要です）。
Workbench に導入する場合は、Workbench の `Scripts/install.ps1` が Config Layer の取得・ビルド・リンクを行います。

シンボリックリンクの作成には Windows の開発者モード、または管理者権限が必要です。
プラグインフォルダ全体ではなく `main.js` と `manifest.json` のみをリンクし、各 Vault の `data.json` は共有しません。

## 2. 共通設定を用意する

共通設定は `~/workspace/dotfiles/obsidian/` に置く。

```text
~/workspace/dotfiles/obsidian/
├── hotkeys.json
├── plugins.json
└── css/
    ├── common.css
    └── ...
```

- `css/*.css`：共通で使う CSS。
- `hotkeys.json`：共通ホットキー。Obsidian の `hotkeys.json` と同じ形式。
- `hotkeys.win32.json`：Windows 固有の上書き設定（任意）。同じコマンド ID だけ共通設定より優先。Mac では読み込みません。
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
| CSS folder | `~/workspace/dotfiles/obsidian/css` |
| Hotkeys folder | `~/workspace/dotfiles/obsidian` |
| Plugins folder | 空欄（Hotkeys folder を使用） |
| Watch external files | ON（共通ファイルの変更を自動反映） |

設定後に行うこと：

1. **Shared CSS** で使いたい CSS を ON にする。ON/OFF は Vault ごとに保存される。
2. **Apply shared hotkeys** の **Apply** を押す。
3. `plugins.json` を使う場合は **Apply required plugins** の **Apply** を押す。

## 4. 普段の使い方

共通ファイルを編集すれば、**Watch external files** が ON の場合は自動で反映される。

- **CSS**：有効にしたファイルの変更が表示に反映される。新しいファイルが一覧に出ない場合は **Refresh CSS files** を押す。
- **ホットキー**：共通設定と同じコマンドは共通側（Windows では `hotkeys.win32.json` で上書きした値）が優先される。それ以外の Vault 固有設定は残る。共通側から削除すると、元の Vault 固有設定があれば復元される（Vault 側で独自変更した値は保護される）。
- **プラグイン**：`plugins.json` にある未導入のプラグインをインストールし、無効なら有効化する。一覧から削除してもアンインストールや無効化はしない。各プラグインの設定は共通化しない。

自動反映を OFF にしている場合は、設定画面の **Refresh** / **Apply** ボタンで手動反映する。
