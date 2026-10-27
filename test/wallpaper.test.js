'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {promisify} = require('node:util');
const {test} = require('node:test');
const os = require('node:os');
const {resolveWallpaper} = require('../src/wallpaper');

test('Scene packages use project preview, fall back to preview.png, and report missing images', async t => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wallpaper-scene-test-'));
  t.after(() => fs.promises.rm(dir, {recursive:true, force:true}));
  const pkg = path.join(dir, 'scene.pkg');
  await fs.promises.writeFile(pkg, 'package');
  await fs.promises.writeFile(path.join(dir, 'project.json'), JSON.stringify({type:'scene', file:'scene.pkg', preview:'封面.jpg'}));
  await fs.promises.writeFile(path.join(dir, '封面.jpg'), 'preview');
  assert.equal(resolveWallpaper(pkg).kind, 'image');
  assert.equal(resolveWallpaper(pkg).file, path.join(dir, '封面.jpg'));
  await fs.promises.unlink(path.join(dir, '封面.jpg'));
  await fs.promises.writeFile(path.join(dir, 'preview.png'), 'fallback');
  assert.equal(resolveWallpaper(dir).file, path.join(dir, 'preview.png'));
  await fs.promises.unlink(path.join(dir, 'preview.png'));
  assert.throws(() => resolveWallpaper(pkg), /沒有可用的預覽圖片/);
});

// Load a fresh detector with only process execution replaced. File IO, result
// decoding, cleanup, and the choice of query transport run as in production.
function detector(run) {
  const execFile = () => {};
  execFile[promisify.custom] = run;
  const module = {exports:{}};
  const filename = path.resolve(__dirname, '../src/wallpaper.js');
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    require: name => name === 'child_process' ? {execFile} : require(name),
    module, __dirname:path.dirname(filename), process:{platform:'win32', env:process.env}
  }, {filename});
  return module.exports;
}

test('ordinary stdout preserves Unicode and explicit monitor selection', async () => {
  const calls = [];
  const api = detector(async (exe, args) => {
    calls.push(Array.from(args));
    return {stdout:'"C:/wallpapers/壁纸.mp4"\r\n'};
  });
  assert.equal(await api.getActiveWallpaper('wallpaper.exe'), 'C:/wallpapers/壁纸.mp4');
  await api.getActiveWallpaper('wallpaper.exe', 0);
  assert.deepEqual(calls, [
    ['-control', 'getWallpaper'],
    ['-control', 'getWallpaper', '-monitor', '0']
  ]);
});

test('empty stdout switches to console capture, preserves Unicode, and cleans up', async () => {
  let directCalls = 0;
  const results = [];
  const diagnostics = [];
  const source = 'C:/壁纸 folder/quoted & name/桌布.mp4';
  const api = detector(async (exe, args, options) => {
    if (!exe.endsWith('powershell.exe')) {
      directCalls++;
      return {stdout:''};
    }
    assert.equal(options.windowsHide, true);
    assert.equal(options.env.WALLPAPER_SYNC_QUERY_MONITOR, '-1');
    assert.equal(options.env.WALLPAPER_SYNC_QUERY_EXE, 'C:/Program Files/WE/wallpaper64.exe');
    assert.ok(args.includes('-File'));
    const resultPath = options.env.WALLPAPER_SYNC_QUERY_RESULT;
    results.push(resultPath);
    await fs.promises.writeFile(resultPath, JSON.stringify({source}), 'utf8');
    return {stdout:''};
  });
  for (let i = 0; i < 2; i++) {
    assert.equal(await api.getActiveWallpaper('C:/Program Files/WE/wallpaper64.exe', -1, m => diagnostics.push(m)), source);
  }
  assert.equal(directCalls, 1);
  assert.equal(diagnostics.length, 1);
  assert.notEqual(results[0], results[1]);
  for (const resultPath of results) assert.equal(fs.existsSync(path.dirname(resultPath)), false);
});

test('console failure is reported and temporary files are removed', async () => {
  let resultPath;
  const api = detector(async (exe, args, options) => {
    if (!exe.endsWith('powershell.exe')) return {stdout:''};
    resultPath = options.env.WALLPAPER_SYNC_QUERY_RESULT;
    await fs.promises.writeFile(resultPath, JSON.stringify({error:'Wallpaper Engine query timed out.'}));
    return {stdout:''};
  });
  await assert.rejects(api.getActiveWallpaper('wallpaper.exe'), /Wallpaper console: Wallpaper Engine query timed out/);
  assert.equal(fs.existsSync(path.dirname(resultPath)), false);
});

test('empty console output gives actionable error rather than a fabricated path', async () => {
  const api = detector(async (exe, args, options) => {
    if (!exe.endsWith('powershell.exe')) return {stdout:''};
    await fs.promises.writeFile(options.env.WALLPAPER_SYNC_QUERY_RESULT, JSON.stringify({source:'  '}));
    return {stdout:''};
  });
  await assert.rejects(api.getActiveWallpaper('wallpaper.exe'), /Confirm it is running with a wallpaper applied/);
});
