# Wallpaper to VS Code

將 Wallpaper Engine 桌布或本機資料夾內的影片、圖片顯示在程式碼編輯區背後，分別調整背景與文字的不透明度。

## 使用前準備

- 使用 Windows 桌面版 VS Code，版本 1.90.0 以上。
- Wallpaper Engine 模式需要安裝並啟動 Wallpaper Engine，先套用一個桌布；資料夾輪播模式不需要 Wallpaper Engine。
- 影片桌布支援 MP4、WebM、M4V。
- Scene／`.pkg` 桌布使用預覽圖片當靜態背景，不播放場景動畫；不支援 Web 桌布。
- VS Code 安裝資料夾需要可寫入權限。

## 啟用背景

1. 在 VS Code 安裝本擴充套件。
2. 按 **Ctrl + Shift + P** 開啟命令選擇區。
3. 執行 **Wallpaper Sync: 開啟控制面板**，選擇背景來源。使用 Wallpaper Engine 時按 **啟用背景**；使用資料夾輪播時選擇資料夾後就會自動啟用。
4. 出現提示後按 **Reload Window**，再開啟程式碼檔案。

啟用狀態會保留，下次開啟相同 VS Code 設定檔時會自動啟動。切換 Wallpaper Engine 桌布後，背景會在下一次查詢時更新。

## 操作指令

### 側邊欄控制面板（0.7.2）

點選左側活動列的 **Wallpaper** 圖示，或執行 **Wallpaper Sync: 開啟控制面板**。

- 啟用／禁用背景，查看目前背景檔案與錯誤。
- 用下拉選單切換 Wallpaper Engine 或資料夾輪播。
- 選擇輪播資料夾；Wallpaper Engine 沿用原有的路徑偵測流程。
- 設定輪播間隔與查詢間隔。
- 背景與文字不透明度可用滑桿或標題右側的 0–100 輸入框調整。放開滑桿，或輸入後按 Enter／離開欄位，就會儲存並套用。
- 查看錯誤紀錄，或確認後還原 VS Code。

面板、原有指令與設定頁共用設定。停用背景時也能調整設定，下次啟用時會套用。

側邊欄不提供執行檔選擇或螢幕索引欄位，一般使用不需要調整這兩項。背景與文字不透明度標題右側都有百分比輸入框，可直接輸入整數，例如 `40` 代表 40%；拖曳滑桿時，輸入框會同步更新。

所有指令都可透過 **Ctrl + Shift + P** 搜尋 `Wallpaper Sync`。

| 指令 | 操作方式 |
| --- | --- |
| **Wallpaper Sync: 開啟控制面板** | 開啟側邊欄，以按鈕、下拉選單、滑桿或輸入框操作背景。 |
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

#### 資料夾裡可以放什麼？

| 類型 | 支援的副檔名 |
| --- | --- |
| 影片 | `.mp4`、`.webm`、`.m4v` |
| 圖片 | `.jpg`、`.jpeg`、`.png`、`.webp`、`.bmp` |

影片和圖片可以混放，副檔名大小寫皆可。例如選擇 `D:\\Wallpapers`：

```text
D:\Wallpapers\
├─ 01-風景.jpg
├─ 02-動畫.mp4
├─ 03-桌布.png
└─ 04-影片.webm
```

會依檔名順序循環顯示。想指定順序，可以在檔名前加上 `01-`、`02-` 等編號。

- 只讀取選定資料夾的第一層，子資料夾裡的檔案不會加入輪播。
- `.gif`、`.avi`、`.mov`、`.mkv`、`.pkg` 和其他未列出的格式會略過。
- `.pkg` 是 Wallpaper Engine 場景封裝，資料夾模式不能直接播放；請放入 JPG／PNG 預覽圖，或切換至 Wallpaper Engine 模式使用場景預覽圖。
- 影片是否能播放也取決於編碼；只改副檔名不會轉換格式。
- 資料夾內沒有支援的檔案時會顯示提示。

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

### 進階設定：Wallpaper Engine 裝在其他磁碟

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
- 若背景沒有出現，先確認背景已啟用、不透明度不是 `0`。Wallpaper Engine 模式需確認桌布正在顯示；資料夾模式需確認資料夾仍存在且包含支援的檔案。詳細訊息可按面板的 **查看錯誤紀錄**，或到 **檢視 → 輸出 → Wallpaper Sync** 查看。
