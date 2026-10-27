/* 這支直接跑在 VS Code 編輯介面裡，這裡不能呼叫擴充套件的 API，也不執行桌布自己的腳本。 */
(() => {
  'use strict';
  const base = new URL('.', document.currentScript.src);
  console.info('[Wallpaper Sync] Blob renderer active:', new URL(document.currentScript.src).search);
  const hosts = new Map();
  let state, busy = false;
  let mediaFile, mediaUrl, disposed = false;
  const controller = new AbortController();
  const style = document.createElement('style');
  style.textContent = `
    .wallpaper-sync-host { position: relative !important; isolation: isolate; }
    .wallpaper-sync-host > .wallpaper-sync-video {
      position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
      z-index: 0; pointer-events: none; user-select: none;
    }
    .wallpaper-sync-host > .editor-instance { position: relative; z-index: 1; }
    .wallpaper-sync-host .monaco-editor .view-lines {
      opacity: var(--wallpaper-sync-text-opacity, 1);
    }
    html body .monaco-workbench .part.editor .wallpaper-sync-host > .editor-instance,
    html body .monaco-workbench .part.editor .wallpaper-sync-host .monaco-editor,
    html body .monaco-workbench .part.editor .wallpaper-sync-host .monaco-editor-background,
    html body .monaco-workbench .part.editor .wallpaper-sync-host .monaco-editor > .overflow-guard,
    html body .monaco-workbench .part.editor .wallpaper-sync-host .monaco-editor .margin {
      background: transparent !important;
    }
  `;
  document.head.appendChild(style);

  function remove(host, video) {
    video.pause?.();
    video.removeAttribute('src');
    video.load?.();
    video.remove();
    host.classList.remove('wallpaper-sync-host');
    host.style.removeProperty('--wallpaper-sync-text-opacity');
    hosts.delete(host);
  }

  function render() {
    const editors = state?.enabled && mediaUrl
      ? new Set([...document.querySelectorAll('.part.editor .editor-group-container > .editor-container')]
          .filter(host => host.querySelector('.monaco-editor')))
      : new Set();
    for (const [host, video] of hosts) {
      if (!editors.has(host) || !host.contains(video) || (video.tagName === 'IMG') !== /\.(jpe?g|png|webp|bmp)$/.test(state.file)) remove(host, video);
    }
    for (const host of editors) {
      let video = hosts.get(host);
      if (!video) {
        video = document.createElement(/\.(jpe?g|png|webp|bmp)$/.test(state.file) ? 'img' : 'video');
        if (video.tagName === 'IMG') video.alt = '';
        video.className = 'wallpaper-sync-video';
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.tabIndex = -1;
        video.setAttribute('aria-hidden', 'true');
        video.addEventListener('error', () => console.warn('[Wallpaper Sync] Background load failed:', video.error?.message, 'source:', video.currentSrc || video.src));
        video.addEventListener('load', () => console.info('[Wallpaper Sync] Preview image loaded'));
        video.addEventListener('loadeddata', () => console.info(`[Wallpaper Sync] Video loaded: ${video.videoWidth}x${video.videoHeight}`));
        host.classList.add('wallpaper-sync-host');
        host.prepend(video);
        hosts.set(host, video);
      }
      const source = mediaUrl;
      if (video.src !== source) video.src = source;
      video.style.opacity = String(state.opacity);
      host.style.setProperty('--wallpaper-sync-text-opacity', String(
        Number.isFinite(state.textOpacity) ? Math.max(0, Math.min(1, state.textOpacity)) : 1
      ));
      if (document.hidden) video.pause?.();
      else if (video.paused) video.play().catch(() => {});
    }
  }

  async function tick() {
    if (busy || disposed) return;
    busy = true;
    try {
      const response = await fetch(new URL('state.json', base), {cache:'no-store', signal:controller.signal});
      if (!response.ok) throw new Error('Background removed');
      const next = await response.json();
      state = next.enabled && /^media-[a-f0-9]{16}\.(mp4|webm|m4v|jpe?g|png|webp|bmp)$/.test(next.file) && Number.isFinite(next.opacity)
        ? {...next, opacity:Math.max(0, Math.min(1, next.opacity))} : null;
      if (state && state.file !== mediaFile) {
        const response = await fetch(new URL(state.file, base), {signal:controller.signal});
        if (!response.ok) throw new Error('Cannot load wallpaper video');
        const blob = await response.blob();
        if (disposed) return;
        const previous = mediaUrl;
        mediaUrl = URL.createObjectURL(blob);
        mediaFile = state.file;
        render();
        if (previous) URL.revokeObjectURL(previous);
      }
    } catch { state = null; }
    finally {
      busy = false;
      if (!disposed) render();
      if (!state && mediaUrl) {
        URL.revokeObjectURL(mediaUrl);
        mediaUrl = mediaFile = undefined;
      }
    }
  }
  document.addEventListener('visibilitychange', render);
  const timer = setInterval(tick, 1000);
  window.addEventListener('pagehide', () => {
    disposed = true;
    controller.abort();
    clearInterval(timer);
    document.removeEventListener('visibilitychange', render);
    for (const [host, video] of hosts) remove(host, video);
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    style.remove();
  }, {once:true});
  tick();
})();
