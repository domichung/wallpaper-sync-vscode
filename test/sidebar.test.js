'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {registerSidebar, validSetting} = require('../src/sidebar');

test('sidebar only accepts known settings with valid types and ranges', () => {
  assert.equal(validSetting('mode', 'folder'), true);
  assert.equal(validSetting('opacity', 0.4), true);
  assert.equal(validSetting('textOpacity', 1), true);
  assert.equal(validSetting('monitor', -1), true);
  for (const [key, value] of [['mode','other'], ['executable','evil.exe'], ['opacity',2],
    ['opacity',NaN], ['opacity','0.5'], ['monitor',1.2], ['slideshowSeconds',1], ['pollSeconds',3601]]) {
    assert.equal(validSetting(key, value), false);
  }
});

test('sidebar sends current state, routes validated actions and drops unknown messages', async () => {
  let provider, receive, dispose;
  const messages = [], actions = [], changes = [], errors = [];
  const vscode = {
    Uri:{joinPath:(...parts) => parts.join('/')},
    window:{registerWebviewViewProvider:(_id, value) => { provider = value; return {dispose() {}}; },
      showErrorMessage:async value => errors.push(value)}
  };
  const panel = registerSidebar(vscode, {extensionUri:'extension', subscriptions:[]}, {
    state:() => ({running:true, mode:'folder', folderPath:'<script>example</script>'}),
    setting:async (key, value) => changes.push([key, value]),
    run:async action => actions.push(action)
  });
  const webview = {cspSource:'vscode-resource:', asWebviewUri:uri => uri,
    postMessage:message => messages.push(message),
    onDidReceiveMessage:callback => { receive = callback; return {dispose() {}}; }};
  provider.resolveWebviewView({webview, onDidDispose:callback => { dispose = callback; }, onDidChangeVisibility() {}});
  assert.ok(webview.html.includes("default-src 'none'"));
  assert.ok(webview.html.includes("script-src 'nonce-"));
  assert.ok(!webview.html.includes('<script>example</script>'));
  await receive({type:'ready'});
  assert.equal(messages.at(-1).mode, 'folder');
  await receive({type:'setting', key:'opacity', value:0.5});
  assert.deepEqual(changes, [['opacity',0.5]]);
  await receive({type:'setting', key:'executable', value:'unexpected.exe'});
  await receive({type:'action', action:'runShell'});
  await receive({type:'action', action:'logs'});
  assert.equal(changes.length, 1);
  assert.deepEqual(actions, ['logs']);
  assert.deepEqual(errors, []);
  dispose();
  const count = messages.length;
  panel.refresh();
  assert.equal(messages.length, count);
});
