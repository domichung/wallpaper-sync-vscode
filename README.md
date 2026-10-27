# Wallpaper Sync for VS Code

## 版本修改紀錄

| 版本 | 修改項目 |
| --- | --- |
| 0.7 | 新增側邊欄控制介面，將背景開關、來源切換、路徑選擇、間隔與透明度設定放進面板。 |
| 0.6 | 新增資料夾索引，可讀取指定資料夾的影片與圖片，自動輪播。 |
| 0.5 | 修復圖片尺寸異常，調整擴充套件圖示大小。 |
| 0.4 | 新增圖片，加入擴充套件圖示。 |

把 Wallpaper Engine 桌布放在 **原生程式碼編輯區背後**，保留一般編輯、選取與滑鼠操作。
Windows 專用；支援 MP4、WebM、M4V。Scene／`.pkg` 桌布自動使用專案的預覽圖片，沒有動畫。
同步影片來源，不同步桌面的精確播放時間。

Scene 桌布優先使用 `project.json` 的 `preview` 圖片，再尋找同資料夾的 `preview.jpg`、`preview.jpeg`、`preview.png`、`preview.webp` 或 `preview.bmp`。沒有圖片時會顯示提示，可自行放入 `preview.jpg` 或 `preview.png`。圖片清晰度取決於預覽圖本身；「調整影片透明度」命令也適用於靜態圖片。

## 使用

1. 開啟 Wallpaper Engine，套用影片桌布。
2. 在此資料夾執行 `npm.cmd start`，不需要 `npm install` 或 F5。
3. 在新視窗執行 **Wallpaper Sync: Enable Background**。
4. 第一次套用後按 **Reload Window**，再開啟程式碼檔案。

背景啟用後會在這個測試環境自動啟動。點右下角的 Wallpaper 可切換開關。
**Disable Background** 即時關閉；
**Restore VS Code** 移除 workbench 修改及暫存影片。
原本的 Preview 分頁已移除。

## 設定

| 設定 | 預設 | 用途 |
| --- | --- | --- |
| `wallpaperSync.executable` | 自動尋找 | Wallpaper Engine 執行檔完整路徑 |
| `wallpaperSync.monitor` | `-1` | 主桌布；`0` 以上指定螢幕 |
| `wallpaperSync.pollSeconds` | `5` | 每次查詢完成後等待的秒數 |
| `wallpaperSync.opacity` | `0.25` | 影片透明度，`0` 至 `1` |
| `wallpaperSync.textOpacity` | `1` | 程式碼文字不透明度，`0` 完全透明，`1` 完全顯示 |

在命令選擇區執行 **Wallpaper Sync: 調整程式碼文字透明度**，輸入 0–100。背景啟用時會套用，不改變影片透明度、游標或選取底色。

執行 **Wallpaper Sync: 調整影片透明度**，輸入 0–100（預設 25）。100 完全顯示影片，0 隱藏影片；設定會儲存，背景啟用時自動套用，文字透明度保持原設定。

## 安裝修改與還原

VS Code 沒有原生編輯區影片背景 API，因此啟用時會在安裝目錄的 `workbench.html` 加入標記過的腳本載入區塊，並建立 `wallpaper-sync/` 資料夾。原始 HTML 保存在 `workbench.html.wallpaper-sync-backup`。安裝時只在 CSP 的 `media-src` 增加 `blob:`，允許讀取完整影片後透過 Blob 播放；還原時撤回此項新增。相同影片共用快取，切換、停用或關閉視窗時釋放 Blob。

這個修改會影響使用同一套 VS Code 安裝的視窗，可能觸發安裝完整性提示；VS Code 更新後需要再次啟用。影片優先使用硬連結，跨磁碟時才複製到安裝目錄。取消安裝此擴充套件前，先執行 **Restore VS Code**。

若無法啟動擴充套件，可在本專案執行：

```powershell
node src/background.js uninstall "你的 VS Code resources/app 路徑"
```

還原只移除本套件的標記區塊，保留其他工具在 HTML 的修改。診斷訊息位於「輸出 → Wallpaper Sync」。Wallpaper Engine 回傳空白 stdout 時會自動使用隱藏主控台讀取中文路徑。

## 開發

無第三方依賴，執行 `npm.cmd test` 測試。
`src/` 包含桌布偵測、隱藏主控台、workbench 安裝/還原、影片圖層及擴充套件入口。`.dev-runtime/` 是獨立測試視窗的設定與快取，已排除版本控制
關閉該視窗並確認沒有未儲存檔案後才可刪除。

最後的最後這只是一個期末作業 有問題我接下來再看看
