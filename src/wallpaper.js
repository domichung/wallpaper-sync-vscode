'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const consoleExecutables = new Set();

function findExecutable(configured) {
  const candidates = [configured,
    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\wallpaper_engine\\wallpaper64.exe',
    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\wallpaper_engine\\wallpaper32.exe'];
  return candidates.find(p => p && fs.existsSync(p));
}

async function captureWallpaperConsole(executable, monitor) {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wallpaper-sync-'));
  const resultPath = path.join(directory, 'result.json');
  const script = path.join(__dirname, 'capture-wallpaper.ps1');
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  try {
    await execFileAsync(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], {
      timeout:15000, windowsHide:true,
      env: {...process.env,
        WALLPAPER_SYNC_QUERY_SCRIPT:script,
        WALLPAPER_SYNC_QUERY_EXE:executable,
        WALLPAPER_SYNC_QUERY_MONITOR:String(monitor),
        WALLPAPER_SYNC_QUERY_RESULT:resultPath
      }
    });
    const result = JSON.parse(await fs.promises.readFile(resultPath, 'utf8'));
    if (result.error) throw new Error(`Wallpaper console: ${result.error}`);
    return String(result.source || '').trim().replace(/^"|"$/g, '');
  } finally {
    await fs.promises.rm(directory, {recursive:true, force:true});
  }
}

async function getActiveWallpaper(executable, monitor = -1, onDiagnostic = () => {}) {
  const args = ['-control','getWallpaper'];
  if (Number.isInteger(monitor) && monitor >= 0) args.push('-monitor', String(monitor));
  let result = '';
  if (!consoleExecutables.has(executable)) {
    const { stdout } = await execFileAsync(executable, args, {timeout:8000, windowsHide:true});
    result = stdout.trim().replace(/^"|"$/g, '');
    if (!result && process.platform === 'win32') {
      consoleExecutables.add(executable);
      onDiagnostic('Wallpaper Engine stdout was empty; using hidden console capture for subsequent queries.');
    }
  }
  if (!result && process.platform === 'win32') result = await captureWallpaperConsole(executable, monitor);
  if (!result) throw new Error('Wallpaper Engine returned no wallpaper. Confirm it is running with a wallpaper applied and check the selected monitor.');
  return result;
}

function resolveWallpaper(input) {
  const absolute = path.resolve(input);
  if (!fs.existsSync(absolute)) throw new Error(`Wallpaper path does not exist: ${absolute}`);
  const stat = fs.statSync(absolute);
  const projectPath = stat.isDirectory() ? path.join(absolute,'project.json') : path.basename(absolute).toLowerCase() === 'project.json' ? absolute : path.join(path.dirname(absolute),'project.json');
  let project = null;
  if (fs.existsSync(projectPath)) {
    try { project = JSON.parse(fs.readFileSync(projectPath,'utf8')); } catch (err) { throw new Error(`Invalid project.json: ${err.message}`); }
  }
  const type = String(project?.type || '').toLowerCase();
  const base = path.dirname(projectPath);
  let file = project?.file ? path.resolve(base,project.file) : absolute;
  const ext = path.extname(file).toLowerCase();
  let kind = type === 'video' || ['.mp4','.webm','.m4v'].includes(ext) ? 'video'
    : type === 'web' || ['.html','.htm'].includes(ext) ? 'web'
    : type === 'scene' || ['.pkg','.json'].includes(ext) ? 'scene' : 'unknown';
  if (kind === 'scene') {
    const candidates = [project?.preview, 'preview.jpg', 'preview.jpeg', 'preview.png', 'preview.webp', 'preview.bmp'];
    const preview = candidates.filter(name => typeof name === 'string' && name)
      .map(name => path.resolve(base, name))
      .find(candidate => {
        const relative = path.relative(base, candidate);
        if (relative.startsWith('..') || path.isAbsolute(relative) || !/\.(jpe?g|png|webp|bmp)$/i.test(candidate)) return false;
        try { return fs.statSync(candidate).isFile(); } catch { return false; }
      });
    if (!preview) throw new Error(`此 Scene 桌布沒有可用的預覽圖片。請在桌布資料夾放入 preview.jpg 或 preview.png：${base}`);
    file = preview;
    kind = 'image';
  }
  return {kind, title:project?.title || path.basename(absolute), source: absolute, file, projectPath:project ? projectPath : null};
}
module.exports = {findExecutable,getActiveWallpaper,resolveWallpaper};
