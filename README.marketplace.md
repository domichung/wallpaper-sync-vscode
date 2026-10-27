# Wallpaper to VS Code

將 Wallpaper Engine 桌布顯示在程式碼編輯區背後，分別調整背景與文字的不透明度。

## 使用前準備

- 使用 Windows 桌面版 VS Code，版本 1.90.0 以上。
- Wallpaper Engine 模式需要安裝並啟動 Wallpaper Engine，先套用一個桌布；資料夾輪播模式不需要 Wallpaper Engine。
- 影片桌布支援 MP4、WebM、M4V。
- Scene／`.pkg` 桌布使用預覽圖片當靜態背景，不播放場景動畫；不支援 Web 桌布。
- VS Code 安裝資料夾需要可寫入權限。

## 啟用背景

1. 在 VS Code 安裝本擴充套件。
2. 按 **Ctrl + Shift + P** 開啟命令選擇區。
3. 執行 **Wallpaper Sync: 啟用背景**。
4. 出現提示後按 **Reload Window**，再開啟程式碼檔案。

啟用狀態會保留，下次開啟相同 VS Code 設定檔時會自動啟動。切換 Wallpaper Engine 桌布後，背景會在下一次查詢時更新。

## 操作指令

所有指令都可透過 **Ctrl + Shift + P** 搜尋 `Wallpaper Sync`。

| 指令 | 操作方式 |
| --- | --- |
| **Wallpaper Sync: 啟用背景** | 啟動桌布同步，首次套用依提示重新載入視窗。 |
| **Wallpaper Sync: 切換背景模式** | 選擇 Wallpaper Engine 或資料夾輪播；選擇資料夾後自動啟用背景。再次選資料夾輪播可更換資料夾。 |
| **Wallpaper Sync: 禁用背景** | 停止同步並隱藏背景。 |
| **Wallpaper Sync: 調整影片透明度** | 輸入 0–100；100 完全顯示，0 隱藏背景，預設 25。靜態圖片也適用。 |
| **Wallpaper Sync: 調整程式碼文字透明度** | 輸入 0–100；100 完全顯示，0 隱藏文字，預設 100。 |
| **Wallpaper Sync: Restore VS Code** | 停止同步並還原背景修改；完成後執行 **Developer: Reload Window**。 |

透明度設定會自動儲存，背景啟用時套用。也可以點右下角的 **Wallpaper** 狀態列按鈕切換啟用／禁用。

## 系統設定

### 資料夾輪播

執行 **Wallpaper Sync: 切換背景模式 → 資料夾輪播**，選擇本機資料夾。可混放 MP4、WebM、M4V 影片與 JPG、JPEG、PNG、WebP、BMP 圖片，依檔名順序循環播放，不包含子資料夾。

預設每 30 秒切換下一個檔案，可用 `wallpaperSync.slideshowSeconds` 調整。影片到時也會切換，不等待播完；較短影片在等待切換期間重複播放。只有一個檔案時會持續顯示。資料夾和模式會儲存，重新啟動後從第一個檔案開始。來源檔案不會被修改。

### 設定項目

按 **Ctrl + ,** 開啟設定，搜尋 `wallpaperSync`。

| 設定 | 預設值 | 說明 |
| --- | --- | --- |
| `wallpaperSync.mode` | `wallpaperEngine` | `wallpaperEngine` 同步桌布；`folder` 使用資料夾輪播。 |
| `wallpaperSync.folderPath` | 空白 | 本機輪播資料夾的完整路徑。 |
| `wallpaperSync.slideshowSeconds` | `30` | 每個檔案的顯示秒數，範圍 2–3600。 |
| `wallpaperSync.executable` | 空白 | Wallpaper Engine 執行檔完整路徑。留空時嘗試從 C 槽預設 Steam 安裝位置尋找。 |
| `wallpaperSync.monitor` | `-1` | 使用預設桌布查詢；若需要指定螢幕，填入從 `0` 開始的螢幕索引。 |
| `wallpaperSync.pollSeconds` | `5` | 每次查詢結束後等待的秒數，可設為 2–3600。 |
| `wallpaperSync.opacity` | `0.25` | 背景不透明度，範圍 0–1。 |
| `wallpaperSync.textOpacity` | `1` | 程式碼文字不透明度，範圍 0–1。 |

### Wallpaper Engine 裝在其他磁碟

將 `wallpaperSync.executable` 設為實際的 `wallpaper64.exe` 或 `wallpaper32.exe` 路徑。例如在 **Preferences: Open User Settings (JSON)** 中合併以下設定，路徑請改成你的安裝位置：

```json
{
  "wallpaperSync.executable": "D:\\SteamLibrary\\steamapps\\common\\wallpaper_engine\\wallpaper64.exe",
  "wallpaperSync.monitor": -1,
  "wallpaperSync.pollSeconds": 5,
  "wallpaperSync.opacity": 0.25,
  "wallpaperSync.textOpacity": 1
}
```

命令輸入的是 **0–100**，設定檔使用的是 **0–1**；例如命令輸入 `40`，對應設定值 `0.4`。

### Scene／PKG 靜態背景

優先讀取桌布 `project.json` 指定的預覽圖片；找不到時，會尋找同資料夾內的 `preview.jpg`、`preview.jpeg`、`preview.png`、`preview.webp` 或 `preview.bmp`。

若提示沒有可用圖片，可在該桌布資料夾放入 `preview.jpg` 或 `preview.png`。畫面清晰度取決於預覽圖片的解析度。

## 重新載入、更新與移除

- 此套件會修改 VS Code 安裝檔以顯示背景，可能出現「安裝已損毀／已修改」的完整性提示；修改會影響使用同一套安裝的視窗。
- VS Code 更新後若背景消失，重新執行 **Wallpaper Sync: 啟用背景**，並依提示重新載入。
- 解除安裝本套件前，先執行 **Wallpaper Sync: Restore VS Code**，再重新載入視窗，最後解除安裝。
- 若背景沒有出現，先確認 Wallpaper Engine 正在執行、執行檔路徑正確，以及背景不透明度不是 `0`。詳細訊息可到 **檢視 → 輸出 → Wallpaper Sync** 查看。
