'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {Slideshow} = require('../src/slideshow');

async function folder(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wallpaper-slideshow-'));
  t.after(() => fs.rm(dir, {recursive:true, force:true}));
  return dir;
}

test('mixed media rotates in natural order, retains current item before deadline and wraps', async t => {
  const dir = await folder(t);
  for (const file of ['10.PNG', '2.mp4', '1.jpg', 'notes.txt']) await fs.writeFile(path.join(dir, file), 'test');
  await fs.mkdir(path.join(dir, '0.png'));
  const slideshow = new Slideshow();
  const selected = async now => path.basename((await slideshow.select(dir, 30, now)).file);
  assert.equal(await selected(0), '1.jpg');
  assert.equal(await selected(29000), '1.jpg');
  assert.equal(await selected(30000), '2.mp4');
  assert.equal(await selected(60000), '10.PNG');
  assert.equal(await selected(90000), '1.jpg');
});

test('removed media and folder changes select available files; empty folders report errors', async t => {
  const first = await folder(t), second = await folder(t);
  await fs.writeFile(path.join(first, 'a.jpg'), 'test');
  await fs.writeFile(path.join(first, 'b.webm'), 'test');
  const slideshow = new Slideshow();
  await slideshow.select(first, 30, 0);
  await fs.unlink(path.join(first, 'a.jpg'));
  assert.equal((await slideshow.select(first, 30, 1000)).file, path.join(first, 'b.webm'));
  await assert.rejects(slideshow.select(second, 30, 2000), /沒有支援/);
  await fs.writeFile(path.join(second, 'new.png'), 'test');
  assert.equal((await slideshow.select(second, 30, 3000)).file, path.join(second, 'new.png'));
  await assert.rejects(slideshow.select('', 30), /完整路徑/);
});
