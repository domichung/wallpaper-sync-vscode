'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('mode command uses folder without Wallpaper Engine and cancellation preserves mode', async () => {
  const values = {mode:'wallpaperEngine'};
  const commands = new Map(), shown = [], errors = [];
  let choice = {mode:'folder'}, selection = [{fsPath:'C:\\pictures'}], queried = 0, changed, panel;
  const settings = {get:(key, fallback) => values[key] ?? fallback, inspect:() => ({}),
    update:async (key, value) => { values[key] = value; }};
  const output = {info() {}, error:e => errors.push(e), show() {}};
  const vscode = {
    env:{appRoot:'app'}, StatusBarAlignment:{Right:1}, ConfigurationTarget:{Workspace:2, Global:1},
    window:{createOutputChannel:() => output, createStatusBarItem:() => ({show() {}}),
      showQuickPick:async () => choice, showOpenDialog:async () => selection,
      showErrorMessage:e => errors.push(e), showWarningMessage:e => errors.push(e)},
    workspace:{getConfiguration:() => settings, onDidChangeConfiguration:callback => { changed = callback; return {dispose() {}}; }},
    commands:{registerCommand:(name, callback) => { commands.set(name, callback); return {dispose() {}}; }}
  };
  const module = {exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/extension.js'), 'utf8'), {
    module, setTimeout:() => 1, clearTimeout() {},
    require:name => {
      if (name === 'vscode') return vscode;
      if (name === './i18n') return require('../src/i18n');
      if (name === './sidebar') return {registerSidebar:(_v, _c, actions) => { panel = actions; return {refresh() {}}; }};
      if (name === './wallpaper') return {findExecutable:() => 'engine.exe',
        getActiveWallpaper:async () => { queried++; return 'engine.mp4'; },
        resolveWallpaper:() => ({kind:'video', file:'engine.mp4'})};
      if (name === './background') return {install:async () => false, show:async (...args) => shown.push(args), hide:async () => {}};
      if (name === './slideshow') return {Slideshow:class {reset() {} async select(folder) { return {file:folder + '/image.jpg'}; }}};
      throw new Error(name);
    }
  });
  module.exports.activate({subscriptions:[], globalState:{get:() => false, update:async () => {}}});
  await commands.get('wallpaperSync.switchMode')();
  assert.equal(values.mode, 'folder');
  assert.equal(values.folderPath, 'C:\\pictures');
  assert.equal(queried, 0);
  assert.equal(shown[0][1], 'C:\\pictures/image.jpg');
  selection = undefined;
  await commands.get('wallpaperSync.switchMode')();
  assert.equal(shown.length, 1);
  choice = {mode:'wallpaperEngine'};
  await commands.get('wallpaperSync.switchMode')();
  assert.equal(values.mode, 'wallpaperEngine');
  assert.equal(queried, 1);
  assert.equal(shown[1][1], 'engine.mp4');
  await panel.setting('language', 'zh-tw');
  changed({affectsConfiguration:key => ['wallpaperSync', 'wallpaperSync.language'].includes(key)});
  assert.equal(panel.state().resolvedLanguage, 'zh-tw');
  assert.equal(panel.state().strings['背景來源'], '背景來源');
  assert.equal(queried, 1);
  assert.deepEqual(errors, []);
  module.exports.deactivate();
});
