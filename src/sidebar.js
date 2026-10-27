'use strict';
const {randomBytes} = require('node:crypto');

function validSetting(key, value) {
  const ranges = {opacity:[0,1], textOpacity:[0,1], monitor:[-1,100], pollSeconds:[2,3600], slideshowSeconds:[2,3600]};
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
<header><h2>Wallpaper</h2><p id="status" role="status">載入中…</p></header>
<button id="toggle" data-action="toggle">啟用背景</button>
<label for="mode">背景來源</label><select id="mode" data-setting="mode"><option value="wallpaperEngine">Wallpaper Engine</option><option value="folder">資料夾輪播</option></select>
<section id="folderSection"><label>輪播資料夾</label><p id="folderPath" class="path"></p><button data-action="folder">選擇資料夾</button>
<label for="slideshowSeconds">每個檔案顯示秒數</label><input id="slideshowSeconds" data-setting="slideshowSeconds" type="number" min="2" max="3600"><small>依檔名輪播，不含子資料夾；影片到時也會切換。</small></section>
<section id="engineSection"><label>Wallpaper Engine 執行檔</label><p id="executable" class="path"></p><button data-action="executable">選擇執行檔</button>
<label for="monitor">螢幕索引</label><input id="monitor" data-setting="monitor" type="number" min="-1" max="100"><small>-1 使用預設桌布，0 起指定螢幕。</small>
<label for="pollSeconds">查詢間隔（秒）</label><input id="pollSeconds" data-setting="pollSeconds" type="number" min="2" max="3600"></section>
<label for="opacity">背景不透明度 <output id="opacityValue"></output></label><input id="opacity" data-setting="opacity" type="range" min="0" max="100">
<label for="textOpacity">文字不透明度 <output id="textOpacityValue"></output></label><input id="textOpacity" data-setting="textOpacity" type="range" min="0" max="100"><small>100% 完全顯示，0% 完全透明。放開滑桿後儲存。</small>
<label>目前背景</label><p id="currentFile" class="path"></p><p id="error" role="alert"></p>
<footer><button class="secondary" data-action="logs">查看錯誤紀錄</button><button class="secondary" data-action="restore">還原 VS Code</button></footer>
<script nonce="${nonce}" src="${resource('sidebar.js')}"></script></body></html>`;
      const subscription = next.webview.onDidReceiveMessage(async message => {
        if (!message || typeof message !== 'object') return;
        if (message.type === 'ready') { refresh(); return; }
        if (busy) { refresh(); return; }
        // 面板只收這幾種操作，不能讓網頁隨便改設定或執行指令。
        if (message.type === 'setting' && !validSetting(message.key, message.value)) { refresh(); return; }
        if (message.type !== 'setting' && !(message.type === 'action' && ['toggle','folder','executable','logs','restore'].includes(message.action))) return;
        busy = true;
        refresh();
        try {
          if (message.type === 'setting') await actions.setting(message.key, message.value);
          else await actions.run(message.action);
        } catch (error) { await vscode.window.showErrorMessage(error.message); }
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
