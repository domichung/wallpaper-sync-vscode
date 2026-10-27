'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');

const BEGIN = '<!-- wallpaper-sync:start -->';
const END = '<!-- wallpaper-sync:end -->';
const BLOCK = /<!-- wallpaper-sync:start -->[\s\S]*?<!-- wallpaper-sync:end -->\r?\n?/g;
const MEDIA_POLICY = /\bmedia-src\s+[^;"<>]+/g;

function allowMediaBlob(html) {
  return html.replace(MEDIA_POLICY, directive => {
    if (/\bblob:/.test(directive)) return directive;
    return directive.replace(/\s*$/, ' blob:$&');
  });
}

async function locations(appRoot) {
  for (const variant of ['electron-browser', 'electron-sandbox']) {
    const directory = path.join(appRoot, 'out', 'vs', 'code', variant, 'workbench');
    const html = path.join(directory, 'workbench.html');
    try {
      await fs.access(html);
      return {html, backup:`${html}.wallpaper-sync-backup`, assets:path.join(directory, 'wallpaper-sync')};
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  throw new Error('Cannot find this VS Code installation\'s workbench.html.');
}

async function writeState(assets, state) {
  const temporary = path.join(assets, `state-${process.pid}.tmp`);
  await fs.writeFile(temporary, JSON.stringify(state));
  await fs.rename(temporary, path.join(assets, 'state.json'));
}

async function install(appRoot) {
  const target = await locations(appRoot);
  const original = await fs.readFile(target.html, 'utf8');
  const clean = original.replace(BLOCK, '');
  if (!clean.includes('</html>')) throw new Error('Unrecognized workbench.html; no files were patched.');
  await fs.mkdir(target.assets, {recursive:true});
  // Preserve the first original; restoration removes only our marked block.
  try { await fs.writeFile(target.backup, clean, {flag:'wx'}); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const renderer = await fs.readFile(path.join(__dirname, 'background-renderer.js'), 'utf8');
  const installedRenderer = path.join(target.assets, 'renderer.js');
  const previousRenderer = await fs.readFile(installedRenderer, 'utf8').catch(() => '');
  if (renderer !== previousRenderer) await fs.writeFile(installedRenderer, renderer);
  try { await fs.access(path.join(target.assets, 'state.json')); }
  catch { await writeState(target.assets, {enabled:false}); }
  const version = createHash('sha256').update(renderer).digest('hex').slice(0, 16);
  const block = `${BEGIN}\n<script src="./wallpaper-sync/renderer.js?v=${version}"></script>\n${END}\n`;
  const patched = allowMediaBlob(clean).replace('</html>', `${block}</html>`);
  if (original !== patched) await fs.writeFile(target.html, patched);
  return original !== patched || renderer !== previousRenderer;
}

async function show(appRoot, file, opacity, textOpacity = 1) {
  const target = await locations(appRoot);
  const extension = path.extname(file).toLowerCase();
  if (!['.mp4', '.webm', '.m4v', '.jpg', '.jpeg', '.png', '.webp', '.bmp'].includes(extension)) throw new Error('Unsupported wallpaper media format.');
  const stat = await fs.stat(file);
  if (!stat.isFile()) throw new Error('The wallpaper is not a media file.');
  const id = createHash('sha256').update(`${file}:${stat.size}:${stat.mtimeMs}`).digest('hex').slice(0, 16);
  const name = `media-${id}${extension}`;
  const destination = path.join(target.assets, name);
  try { await fs.access(destination); }
  catch {
    // Link on the same drive; copy across drives. Media stays in VS Code's app root.
    try { await fs.link(file, destination); }
    catch { await fs.copyFile(file, destination); }
  }
  await writeState(target.assets, {enabled:true, file:name, opacity:Math.max(0, Math.min(1, opacity)),
    textOpacity:Number.isFinite(textOpacity) ? Math.max(0, Math.min(1, textOpacity)) : 1});
  for (const old of await fs.readdir(target.assets)) {
    if (old !== name && /^media-[a-f0-9]{16}\.(mp4|webm|m4v|jpe?g|png|webp|bmp)$/.test(old)) {
      await fs.unlink(path.join(target.assets, old)).catch(() => {}); // Old playback may still hold a Windows file handle.
    }
  }
}

async function hide(appRoot) {
  const target = await locations(appRoot);
  try { await fs.access(target.assets); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  await writeState(target.assets, {enabled:false});
}

async function uninstall(appRoot) {
  const target = await locations(appRoot);
  const current = await fs.readFile(target.html, 'utf8');
  let clean = current.replace(BLOCK, '');
  const backup = await fs.readFile(target.backup, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  // Undo only our media-policy addition, preserving unrelated HTML edits.
  for (const directive of backup.match(MEDIA_POLICY) || []) {
    const patched = allowMediaBlob(directive);
    if (patched !== directive) clean = clean.replace(patched, directive);
  }
  if (current !== clean) await fs.writeFile(target.html, clean);
  // Exact extension-owned paths beneath the verified workbench directory.
  await fs.rm(target.assets, {recursive:true, force:true});
  await fs.rm(target.backup, {force:true});
}

module.exports = {install, show, hide, uninstall, locations};

if (require.main === module) {
  if (process.argv[2] !== 'uninstall' || !process.argv[3]) {
    console.error('Usage: node src/background.js uninstall "<VS Code resources/app path>"');
    process.exitCode = 1;
  } else uninstall(path.resolve(process.argv[3])).catch(error => { console.error(error); process.exitCode = 1; });
}
