'use strict';
const {randomBytes} = require('node:crypto');

function validSetting(key, value) {
  const ranges = {opacity:[0,1], textOpacity:[0,1], pollSeconds:[2,3600], slideshowSeconds:[2,3600]};
  if (key === 'language') return ['auto', 'en', 'zh-tw'].includes(value);
  if (key === 'mode') return ['folder', 'wallpaperEngine'].includes(value);
  const range = ranges[key];
  return !!range && typeof value === 'number' && Number.isFinite(value) && value >= range[0] && value <= range[1]
    && (['opacity','textOpacity'].includes(key) || Number.isInteger(value));
}

function registerSidebar(vscode, context, actions) {
  let view, busy = false;
  function refresh() { if (view) void view.webview.postMessage({type:'state', ...actions.state(), busy}); }
  const provider = {
    resolveWebviewView(next) {
      view = next;
      const root = vscode.Uri.joinPath(context.extensionUri, 'assets');
      next.webview.options = {enableScripts:true, localResourceRoots:[root]};
      const nonce = randomBytes(16).toString('hex');
      const resource = name => next.webview.asWebviewUri(vscode.Uri.joinPath(root, name));
      next.webview.html = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${next.webview.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${resource('sidebar.css')}"></head><body>
<label for="language" data-i18n="介面語言">介面語言</label><select id="language" data-setting="language"><option value="auto" data-i18n="自動（跟隨 VS Code）">自動（跟隨 VS Code）</option><option value="zh-tw">繁體中文</option><option value="en">English</option></select><small data-i18n="指令名稱與設定頁說明仍跟隨 VS Code 語言。">指令名稱與設定頁說明仍跟隨 VS Code 語言。</small>
<header><h2 data-i18n="Wallpaper">Wallpaper</h2><p id="status" role="status" data-i18n="載入中…">載入中…</p></header>
<button id="toggle" data-action="toggle" data-i18n="啟用背景">啟用背景</button>
<label for="mode" data-i18n="背景來源">背景來源</label><select id="mode" data-setting="mode"><option value="wallpaperEngine" data-i18n="Wallpaper Engine">Wallpaper Engine</option><option value="folder" data-i18n="資料夾輪播">資料夾輪播</option></select>
<section id="folderSection"><label data-i18n="輪播資料夾">輪播資料夾</label><p id="folderPath" class="path"></p><button data-action="folder" data-i18n="選擇資料夾">選擇資料夾</button>
<label for="slideshowSeconds" data-i18n="每個檔案顯示秒數">每個檔案顯示秒數</label><input id="slideshowSeconds" data-setting="slideshowSeconds" type="number" min="2" max="3600"><small data-i18n="依檔名輪播，不含子資料夾；影片到時也會切換。">依檔名輪播，不含子資料夾；影片到時也會切換。</small></section>
<section id="engineSection">
<label for="pollSeconds" data-i18n="查詢間隔（秒）">查詢間隔（秒）</label><input id="pollSeconds" data-setting="pollSeconds" type="number" min="2" max="3600"></section>
<div class="opacity-row"><label for="opacityNumber" data-i18n="背景不透明度">背景不透明度</label><div class="percent"><input id="opacityNumber" aria-label="背景不透明度百分比" data-i18n-aria="背景不透明度百分比" data-setting="opacity" data-percent="true" type="number" min="0" max="100" step="1"><span>%</span></div></div>
<input id="opacity" aria-label="背景不透明度滑桿" data-i18n-aria="背景不透明度滑桿" data-setting="opacity" data-percent="true" type="range" min="0" max="100">
<div class="opacity-row"><label for="textOpacityNumber" data-i18n="文字不透明度">文字不透明度</label><div class="percent"><input id="textOpacityNumber" aria-label="文字不透明度百分比" data-i18n-aria="文字不透明度百分比" data-setting="textOpacity" data-percent="true" type="number" min="0" max="100" step="1"><span>%</span></div></div>
<input id="textOpacity" aria-label="文字不透明度滑桿" data-i18n-aria="文字不透明度滑桿" data-setting="textOpacity" data-percent="true" type="range" min="0" max="100"><small data-i18n="100% 完全顯示，0% 完全透明。放開滑桿，或輸入數字後按 Enter／離開欄位，就會儲存。">100% 完全顯示，0% 完全透明。放開滑桿，或輸入數字後按 Enter／離開欄位，就會儲存。</small>
<label data-i18n="目前背景">目前背景</label><p id="currentFile" class="path"></p><p id="error" role="alert"></p>
<footer><button class="secondary" data-action="logs" data-i18n="查看錯誤紀錄">查看錯誤紀錄</button><button class="secondary" data-action="restore" data-i18n="還原 VS Code">還原 VS Code</button></footer>
<script nonce="${nonce}" src="${resource('sidebar.js')}"></script></body></html>`;
      const subscription = next.webview.onDidReceiveMessage(async message => {
        if (!message || typeof message !== 'object') return;
        if (message.type === 'ready') { refresh(); return; }
        if (busy) { refresh(); return; }
        // 面板只收這幾種操作，不能讓網頁隨便改設定或執行指令。
        if (message.type === 'setting' && !validSetting(message.key, message.value)) { refresh(); return; }
        if (message.type !== 'setting' && !(message.type === 'action' && ['toggle','folder','logs','restore'].includes(message.action))) return;
        busy = true;
        refresh();
        try {
          if (message.type === 'setting') await actions.setting(message.key, message.value);
          else await actions.run(message.action);
        } catch (error) { await vscode.window.showErrorMessage(actions.error ? actions.error(error.message) : error.message); }
        finally { busy = false; refresh(); }
      });
      next.onDidDispose(() => { subscription.dispose(); if (view === next) view = undefined; });
      next.onDidChangeVisibility(() => { if (next.visible) refresh(); });
    }
  };
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('wallpaperSync.controls', provider));
  return {refresh};
}
module.exports = {registerSidebar, validSetting};
