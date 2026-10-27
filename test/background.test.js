'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const background = require('../src/background');

async function fixture(t, variant = 'electron-browser') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wallpaper-background-test-'));
  t.after(() => fs.rm(root, {recursive:true, force:true}));
  const directory = path.join(root, 'out/vs/code', variant, 'workbench');
  await fs.mkdir(directory, {recursive:true});
  const original = '<html>\r\n<head><meta http-equiv="Content-Security-Policy" content="default-src self"></head>\r\n<body></body>\r\n<script src="./workbench.js"></script>\r\n</html>\r\n';
  await fs.writeFile(path.join(directory, 'workbench.html'), original);
  return {root, original, directory};
}

test('install twice keeps one loader, the CSP and original backup; restore is lossless', async t => {
  const {root, original} = await fixture(t);
  assert.equal(await background.install(root), true);
  const locations = await background.locations(root);
  const first = await fs.readFile(locations.html, 'utf8');
  assert.equal(await background.install(root), false);
  assert.equal(await fs.readFile(locations.html, 'utf8'), first);
  assert.equal(first.match(/src="\.\/wallpaper-sync\/renderer\.js\?v=[a-f0-9]{16}"/g).length, 1);
  assert.ok(first.includes('content="default-src self"'));
  assert.equal(await fs.readFile(locations.backup, 'utf8'), original);
  await background.uninstall(root);
  assert.equal(await fs.readFile(locations.html, 'utf8'), original);
  await assert.rejects(fs.access(locations.assets), {code:'ENOENT'});
});

test('restore preserves unrelated edits made after installation and supports sandbox layout', async t => {
  const {root, original} = await fixture(t, 'electron-sandbox');
  await background.install(root);
  const {html} = await background.locations(root);
  await fs.appendFile(html, '<!-- another tool -->');
  await background.uninstall(root);
  assert.equal(await fs.readFile(html, 'utf8'), original + '<!-- another tool -->');
});

test('video replacement and disabling never alter original media', async t => {
  const {root} = await fixture(t);
  const video = path.join(root, '壁纸 & test.mp4');
  const next = path.join(root, 'preview.jpg');
  await fs.writeFile(video, 'first-video');
  await fs.writeFile(next, 'next-video');
  await background.install(root);
  const {assets} = await background.locations(root);
  await background.show(root, video, 0.25);
  let state = JSON.parse(await fs.readFile(path.join(assets, 'state.json')));
  assert.equal(state.opacity, 0.25);
  assert.equal(await fs.readFile(path.join(assets, state.file), 'utf8'), 'first-video');
  await background.show(root, next, 2);
  state = JSON.parse(await fs.readFile(path.join(assets, 'state.json')));
  assert.equal(state.opacity, 1);
  assert.equal((await fs.readdir(assets)).filter(name => name.startsWith('media-')).length, 1);
  await background.hide(root);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(assets, 'state.json'))), {enabled:false});
  await background.uninstall(root);
  assert.equal(await fs.readFile(video, 'utf8'), 'first-video');
  assert.equal(await fs.readFile(next, 'utf8'), 'next-video');
});

test('unknown workbench format is rejected without changing it', async t => {
  const {root, directory} = await fixture(t);
  const html = path.join(directory, 'workbench.html');
  await fs.writeFile(html, 'unexpected format');
  await assert.rejects(background.install(root), /Unrecognized workbench/);
  assert.equal(await fs.readFile(html, 'utf8'), 'unexpected format');
  await assert.rejects(fs.access(path.join(directory, 'wallpaper-sync')), {code:'ENOENT'});
});

test('Blob media permission is narrow, idempotent and reversible', async t => {
  const {root, directory} = await fixture(t);
  const html = path.join(directory, 'workbench.html');
  const original = `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src\n 'self'\n ; script-src 'self';"></head></html>`;
  await fs.writeFile(html, original);
  await background.install(root);
  const installed = await fs.readFile(html, 'utf8');
  assert.ok(installed.includes("media-src\n 'self' blob:\n ;"));
  assert.ok(installed.includes("script-src 'self';"));
  assert.equal(await background.install(root), false);
  await fs.appendFile(html, '<!-- unrelated -->');
  await background.uninstall(root);
  assert.equal(await fs.readFile(html, 'utf8'), original + '<!-- unrelated -->');
});

test('preexisting Blob media permission is preserved on restore', async t => {
  const {root, directory} = await fixture(t);
  const html = path.join(directory, 'workbench.html');
  const original = `<html><head><meta http-equiv="Content-Security-Policy" content="media-src 'self' blob:;"></head></html>`;
  await fs.writeFile(html, original);
  await background.install(root);
  await background.uninstall(root);
  assert.equal(await fs.readFile(html, 'utf8'), original);
});
