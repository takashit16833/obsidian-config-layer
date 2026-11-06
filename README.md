# Config Layer

複数の Obsidian Vault で CSS・ホットキー・コミュニティプラグインを共通化するためのプラグイン。
デスクトップ版 Obsidian で使用する。

## 1. 共通設定を用意する

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

## 2. Vault ごとに設定する

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

## 3. 普段の使い方

共通ファイルを編集すれば、**Watch external files** が ON の場合は自動で反映される。

- **CSS**：有効にしたファイルの変更が表示に反映される。新しいファイルが一覧に出ない場合は **Refresh CSS files** を押す。
- **ホットキー**：共通設定と同じコマンドは共通側が優先される。それ以外の Vault 固有設定は残る。共通側から削除すると、元の Vault 固有設定があれば復元される（Vault 側で独自変更した値は保護される）。
- **プラグイン**：`plugins.json` にある未導入のプラグインをインストールし、無効なら有効化する。一覧から削除してもアンインストールや無効化はしない。各プラグインの設定は共通化しない。

自動反映を OFF にしている場合は、設定画面の **Refresh** / **Apply** ボタンで手動反映する。
