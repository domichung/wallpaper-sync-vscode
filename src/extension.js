'use strict';
const vscode = require('vscode');
const {findExecutable, getActiveWallpaper, resolveWallpaper} = require('./wallpaper');
const background = require('./background');

let shutdown;

function activate(context) {
  const output = vscode.window.createOutputChannel('Wallpaper Sync', {log:true});
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(output, status);
  const appRoot = vscode.env.appRoot;
  const config = () => vscode.workspace.getConfiguration('wallpaperSync');
  let running = false, timer, pending, installed = false, lastKey, lastError;

  function setStatus(text) {
    status.text = text;
    status.command = running ? 'wallpaperSync.stop' : 'wallpaperSync.start';
    status.tooltip = lastError || (running ? 'Click to stop the wallpaper background' : 'Click to enable the wallpaper background');
  }

  async function sync() {
    const exe = findExecutable(config().get('executable', ''));
    if (!exe) throw new Error('Set wallpaperSync.executable to your Wallpaper Engine executable.');
    const source = await getActiveWallpaper(exe, config().get('monitor', -1), message => output.info(message));
    if (!running) return;
    const wallpaper = resolveWallpaper(source);
    if (!['video', 'image'].includes(wallpaper.kind)) throw new Error('請選擇影片或具有預覽圖片的 Scene 桌布；目前不支援 Web 桌布。');
    let reload = false;
    if (!installed) {
      reload = await background.install(appRoot);
      installed = true;
    }
    const opacity = config().get('opacity', 0.25);
    const textOpacity = config().get('textOpacity', 1);
    const key = `${wallpaper.file}:${opacity}:${textOpacity}`;
    if (key !== lastKey) {
      await background.show(appRoot, wallpaper.file, opacity, textOpacity);
      lastKey = key;
      output.info(`Background: ${wallpaper.file}`);
    }
    if (lastError) output.info('Wallpaper detection recovered.');
    lastError = undefined;
    setStatus('$(paintcan) Wallpaper');
    if (reload) {
      vscode.window.showInformationMessage('Background installed. Reload this window to display it behind your code.', 'Reload Window')
        .then(choice => { if (choice) vscode.commands.executeCommand('workbench.action.reloadWindow'); });
    }
  }

  function poll() {
    clearTimeout(timer);
    if (!running) return Promise.resolve();
    if (pending) return pending;
    pending = sync().catch(async error => {
      if (!running) return;
      if (lastError !== error.message) output.error(error.stack || error.message);
      lastError = error.message;
      lastKey = undefined;
      if (installed) await background.hide(appRoot).catch(() => {});
      setStatus('$(warning) Wallpaper');
    }).finally(() => {
      pending = undefined;
      if (running) timer = setTimeout(poll, config().get('pollSeconds', 5) * 1000);
    });
    return pending;
  }

  async function start() {
    running = true;
    await context.globalState.update('enabled', true);
    setStatus('$(sync~spin) Wallpaper');
    await poll();
    if (lastError) { output.show(true); vscode.window.showWarningMessage(lastError); }
  }

  async function stop(remove = false) {
    running = false;
    clearTimeout(timer);
    await context.globalState.update('enabled', false);
    await pending;
    if (remove) { await background.uninstall(appRoot); installed = false; }
    else await background.hide(appRoot);
    lastKey = lastError = undefined;
    setStatus('$(circle-slash) Wallpaper');
    output.info(remove ? 'Workbench restored.' : 'Background disabled.');
  }

  const command = (name, action) => context.subscriptions.push(vscode.commands.registerCommand(name, () =>
    action().catch(error => { output.error(error.stack || error.message); output.show(true); vscode.window.showErrorMessage(error.message); })
  ));
  command('wallpaperSync.start', start);
  command('wallpaperSync.stop', () => stop());
  command('wallpaperSync.uninstall', () => stop(true));
  async function adjustOpacity(key, title, defaultValue) {
    const value = await vscode.window.showInputBox({
      title,
      prompt:'輸入不透明度 0–100：100 完全顯示，0 完全透明（背景啟用時生效）',
      value:String(Math.round(config().get(key, defaultValue) * 100)),
      validateInput:value => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100
        ? undefined : '請輸入 0 到 100 的數字'
    });
    if (value === undefined) return;
    const settings = config();
    const inspected = settings.inspect(key);
    const target = inspected?.workspaceValue !== undefined
      ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
    await settings.update(key, Number(value) / 100, target);
  }
  command('wallpaperSync.textOpacity', () => adjustOpacity('textOpacity', '程式碼文字透明度', 1));
  command('wallpaperSync.videoOpacity', () => adjustOpacity('opacity', '影片透明度', 0.25));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    if (running && event.affectsConfiguration('wallpaperSync')) poll();
  }));
  shutdown = () => { running = false; clearTimeout(timer); };
  setStatus('$(circle-slash) Wallpaper');
  status.show();
  if (context.globalState.get('enabled', false)) start().catch(error => output.error(error));
}

function deactivate() { shutdown?.(); }
module.exports = {activate, deactivate};
