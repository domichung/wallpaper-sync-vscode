'use strict';
const vscode = require('vscode');
const {findExecutable, getActiveWallpaper, resolveWallpaper} = require('./wallpaper');
const background = require('./background');
const {Slideshow} = require('./slideshow');
const {registerSidebar} = require('./sidebar');
const {createTranslator} = require('./i18n');

let shutdown;

function activate(context) {
  const output = vscode.window.createOutputChannel('Wallpaper Sync', {log:true});
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(output, status);
  const appRoot = vscode.env.appRoot;
  const config = () => vscode.workspace.getConfiguration('wallpaperSync');
  const i18n = createTranslator(() => config().get('language', 'auto'), vscode.env.language);
  const t = i18n.t;
  let running = false, timer, pending, installed = false, lastKey, lastError;
  let revision = 0, changingMode = false;
  const slideshow = new Slideshow();
  let sidebar, currentFile = '';

  function setStatus(text) {
    status.text = text;
    status.command = running ? 'wallpaperSync.stop' : 'wallpaperSync.start';
    status.tooltip = (lastError && i18n.error(lastError)) || (running ? t('Click to stop the wallpaper background') : t('Click to enable the wallpaper background'));
    sidebar?.refresh();
  }

  async function sync() {
    const currentRevision = revision;
    const settings = config();
    let wallpaper;
    if (settings.get('mode', 'wallpaperEngine') === 'folder') {
      wallpaper = await slideshow.select(settings.get('folderPath', ''), settings.get('slideshowSeconds', 30));
    } else {
      const exe = findExecutable(settings.get('executable', ''));
      if (!exe) throw new Error('Set wallpaperSync.executable to your Wallpaper Engine executable.');
      const source = await getActiveWallpaper(exe, settings.get('monitor', -1), message => output.info(message));
      if (!running || currentRevision !== revision) return;
      wallpaper = resolveWallpaper(source);
      if (!['video', 'image'].includes(wallpaper.kind)) throw new Error('請選擇影片或具有預覽圖片的 Scene 桌布；目前不支援 Web 桌布。');
    }
    if (!running || currentRevision !== revision) return;
    let reload = false;
    if (!installed) {
      reload = await background.install(appRoot);
      installed = true;
    }
    if (!running || currentRevision !== revision) return;
    const opacity = config().get('opacity', 0.25);
    const textOpacity = config().get('textOpacity', 1);
    const key = `${wallpaper.file}:${opacity}:${textOpacity}`;
    if (key !== lastKey) {
      await background.show(appRoot, wallpaper.file, opacity, textOpacity);
      lastKey = key;
      currentFile = wallpaper.file;
      output.info(`Background: ${wallpaper.file}`);
    }
    if (lastError) output.info('Wallpaper detection recovered.');
    lastError = undefined;
    setStatus('$(paintcan) Wallpaper');
    if (reload) {
      vscode.window.showInformationMessage(t('Background installed. Reload this window to display it behind your code.'), t('Reload Window'))
        .then(choice => { if (choice) vscode.commands.executeCommand('workbench.action.reloadWindow'); });
    }
  }

  function poll() {
    clearTimeout(timer);
    if (!running || changingMode) return Promise.resolve();
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
      if (running) timer = setTimeout(poll, config().get('mode', 'wallpaperEngine') === 'folder' ? 1000 : config().get('pollSeconds', 5) * 1000);
    });
    return pending;
  }

  async function start() {
    running = true;
    await context.globalState.update('enabled', true);
    setStatus('$(sync~spin) Wallpaper');
    await poll();
    if (lastError) { output.show(true); vscode.window.showWarningMessage(i18n.error(lastError)); }
  }

  async function stop(remove = false) {
    running = false;
    revision++;
    slideshow.reset();
    clearTimeout(timer);
    await context.globalState.update('enabled', false);
    await pending;
    if (remove) { await background.uninstall(appRoot); installed = false; }
    else await background.hide(appRoot);
    lastKey = lastError = undefined;
    currentFile = '';
    setStatus('$(circle-slash) Wallpaper');
    output.info(remove ? 'Workbench restored.' : 'Background disabled.');
  }

  const command = (name, action) => context.subscriptions.push(vscode.commands.registerCommand(name, () =>
    action().catch(error => { output.error(error.stack || error.message); output.show(true); vscode.window.showErrorMessage(i18n.error(error.message)); })
  ));
  command('wallpaperSync.start', start);
  command('wallpaperSync.stop', () => stop());
  command('wallpaperSync.uninstall', () => stop(true));
  async function updateSetting(key, value) {
    const settings = config();
    const target = settings.inspect(key)?.workspaceValue !== undefined
      ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
    await settings.update(key, value, target);
  }
  async function switchMode(mode) {
    const choice = mode ? {mode} : await vscode.window.showQuickPick([
      {label:'Wallpaper Engine', description:t('同步目前套用的桌布'), mode:'wallpaperEngine'},
      {label:t('資料夾輪播'), description:t('依檔名輪播影片與圖片'), mode:'folder'}
    ], {title:t('切換背景模式')});
    if (!choice) return;
    let folder;
    if (choice.mode === 'folder') {
      const selection = await vscode.window.showOpenDialog({canSelectFiles:false, canSelectFolders:true,
        canSelectMany:false, openLabel:t('使用此資料夾'), title:t('選擇影片與圖片資料夾')});
      if (!selection?.length) return;
      folder = selection[0].fsPath;
      await new Slideshow().select(folder, 30);
    }
    changingMode = true;
    revision++;
    clearTimeout(timer);
    try {
      await pending;
      if (folder) await updateSetting('folderPath', folder);
      await updateSetting('mode', choice.mode);
      slideshow.reset();
      lastKey = undefined;
    } finally { changingMode = false; }
    await start();
  }
  command('wallpaperSync.switchMode', () => switchMode());
  async function adjustOpacity(key, title, defaultValue) {
    const value = await vscode.window.showInputBox({
      title,
      prompt:t('輸入不透明度 0–100：100 完全顯示，0 完全透明（背景啟用時生效）'),
      value:String(Math.round(config().get(key, defaultValue) * 100)),
      validateInput:value => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100
        ? undefined : t('請輸入 0 到 100 的數字')
    });
    if (value === undefined) return;
    const settings = config();
    const inspected = settings.inspect(key);
    const target = inspected?.workspaceValue !== undefined
      ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
    await settings.update(key, Number(value) / 100, target);
  }
  command('wallpaperSync.textOpacity', () => adjustOpacity('textOpacity', t('程式碼文字透明度'), 1));
  command('wallpaperSync.videoOpacity', () => adjustOpacity('opacity', t('影片透明度'), 0.25));
  sidebar = registerSidebar(vscode, context, {
    error:i18n.error,
    state:() => {
      const defaults = {language:'auto', mode:'wallpaperEngine', folderPath:'', monitor:-1,
        pollSeconds:5, slideshowSeconds:30, opacity:0.25, textOpacity:1};
      return {running, error:lastError ? i18n.error(lastError) : '', currentFile, strings:i18n.strings(), resolvedLanguage:i18n.language(),
        ...Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, config().get(key, value)]))};
    },
    setting:async (key, value) => {
      if (key === 'mode') await switchMode(value);
      else await updateSetting(key, value);
    },
    run:async action => {
      if (action === 'toggle') return running ? stop() : start();
      if (action === 'folder') return switchMode('folder');
      if (action === 'logs') return output.show(true);
      if (action === 'restore') {
        const confirmed = await vscode.window.showWarningMessage(t('要移除背景修改並還原 VS Code 嗎？'), {modal:true}, t('還原'));
        if (confirmed !== t('還原')) return;
        await stop(true);
        const reload = await vscode.window.showInformationMessage(t('已還原，重新載入視窗後完成。'), t('Reload Window'));
        if (reload) await vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
    }
  });
  command('wallpaperSync.openPanel', async () => { await vscode.commands.executeCommand('wallpaperSync.controls.focus'); });
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    if (!event.affectsConfiguration('wallpaperSync')) return;
    sidebar.refresh();
    if (event.affectsConfiguration('wallpaperSync.language') && !['mode','folderPath','slideshowSeconds','executable','monitor','pollSeconds','opacity','textOpacity'].some(key => event.affectsConfiguration('wallpaperSync.' + key))) {
      setStatus(status.text);
      return;
    }
    revision++;
    if (event.affectsConfiguration('wallpaperSync.mode') || event.affectsConfiguration('wallpaperSync.folderPath')) slideshow.reset();
    if (running && !changingMode) {
      const refresh = async () => { await pending; if (running && !changingMode) await poll(); };
      refresh().catch(error => output.error(error));
    }
  }));
  shutdown = () => { running = false; clearTimeout(timer); };
  setStatus('$(circle-slash) Wallpaper');
  status.show();
  if (context.globalState.get('enabled', false)) start().catch(error => output.error(error));
}

function deactivate() { shutdown?.(); }
module.exports = {activate, deactivate};
