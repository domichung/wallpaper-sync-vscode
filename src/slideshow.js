'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const supported = /\.(mp4|webm|m4v|jpe?g|png|webp|bmp)$/i;

class Slideshow {
  reset() { this.directory = this.current = undefined; this.started = 0; }
  constructor() { this.reset(); }
  async select(directory, seconds, now = Date.now()) {
    if (!directory || !path.isAbsolute(directory)) throw new Error('請先選擇輪播資料夾，或設定 wallpaperSync.folderPath 的完整路徑。');
    const entries = await fs.readdir(directory, {withFileTypes:true});
    const files = entries.filter(entry => entry.isFile() && supported.test(entry.name))
      .map(entry => path.join(directory, entry.name))
      .sort((a, b) => a.localeCompare(b, 'en', {numeric:true}));
    if (!files.length) { this.reset(); throw new Error('輪播資料夾內沒有支援的影片或圖片（不包含子資料夾）。'); }
    const index = files.indexOf(this.current);
    const interval = Math.max(2, Number.isFinite(seconds) ? seconds : 30) * 1000;
    if (directory !== this.directory || index < 0) {
      this.current = files[0];
      this.started = now;
    } else if (now - this.started >= interval) {
      this.current = files[(index + 1) % files.length];
      this.started = now;
    }
    this.directory = directory;
    return {file:this.current};
  }
}
module.exports = {Slideshow};
