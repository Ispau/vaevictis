import { pixelText } from './pixel-hud.js';
import { bitmapLines } from './pixel-interface.js';

const clamp = n => Math.max(0, Math.min(1, n));
export function storyTimeline(scenes, seconds) {
  let offset = 0;
  for (let index = 0; index < scenes.length; index++) {
    const duration = Math.max(1.4, Number(scenes[index].duration) || 7);
    if (seconds < offset + duration) {
      const local = Math.max(0, seconds - offset);
      return { index, local, duration, done: false, visibility: Math.min(clamp(local / .7), clamp((duration - local) / .7)) };
    }
    offset += duration;
  }
  return { index: Math.max(0, scenes.length - 1), local: 0, visibility: 0, done: true };
}
export function animationFrame(animation, seconds, loop = false) {
  const count = Math.max(1, animation?.frames || 1);
  const frame = Math.floor(Math.max(0, seconds) * (animation?.fps || 10));
  return loop ? frame % count : Math.min(count - 1, frame);
}
export function trainingEffect(seconds) {
  const phase = Math.max(0, seconds) % 2.8;
  return { drop: clamp((phase - .25) / .55), visible: phase >= .25 && phase < 1.55,
    impact: phase >= .8 && phase < 1.05, flash: phase >= .8 && phase < .92 };
}

export class StoryPlayer {
  constructor({ panel, canvas, skipButton, announce = () => {}, onFinish = () => {}, onPendingSkip = () => {} }) {
    Object.assign(this, { panel, canvas, skipButton, announce, onFinish, onPendingSkip });
    this.ctx = canvas.getContext('2d'); this.active = false; this.images = new Map();
    skipButton.addEventListener('click', () => this.skip());
  }
  prepare(kind) {
    this.panel.hidden = false;
    const g = this.ctx; g.fillStyle = '#050810'; g.fillRect(0, 0, 512, 288);
    const title = kind === 'ending' ? 'THE LAST PROMISE' : 'THE OATH OF BRUTUS';
    pixelText(g, title, Math.round((512 - title.length * 12) / 2), 128, '#F1D078', 2);
    pixelText(g, 'PREPARING STORY...', 202, 160, '#87969C');
    this.skipButton.focus({ preventScroll: true });
  }
  async load() {
    if (this.manifest) return true;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const response = await fetch('./assets/story/manifest.json', { cache: 'no-store' });
        if (!response.ok) return false;
        const manifest = await response.json();
        if (!Array.isArray(manifest.scenes) || !manifest.scenes.length) return false;
        const effectPaths = effects => Object.values(effects || {}).map(effect => effect?.src).filter(Boolean);
        const paths = [...new Set([...manifest.scenes.flatMap(s => [s.background, s.actor, s.animation?.src, ...effectPaths(s.effects)]), ...effectPaths(manifest.effects)].filter(Boolean))];
        await Promise.all(paths.map(path => new Promise((resolve, reject) => {
          const image = new Image(); const timer = setTimeout(() => reject(new Error('Story image timed out')), 15000);
          image.onload = () => { clearTimeout(timer); this.images.set(path, image); resolve(); };
          image.onerror = () => { clearTimeout(timer); reject(new Error('Story image unavailable')); };
          image.src = new URL(path, document.baseURI).href;
        })));
        this.manifest = manifest; return true;
      } catch { return false; }
      finally { this.loading = null; }
    })();
    return this.loading;
  }
  start(kind, singleScene = null) {
    if (!this.manifest) return false;
    const ids = singleScene ? [singleScene] : this.manifest[kind];
    this.scenes = (ids || []).map(id => this.manifest.scenes.find(s => s.id === id)).filter(Boolean);
    if (!this.scenes.length) return false;
    this.kind = kind; this.elapsed = 0; this.lastScene = -1; this.skipElapsed = null; this.active = true;
    this.panel.hidden = false; this.panel.setAttribute('aria-label', kind === 'ending' ? 'Brutus: farewell' : 'Brutus: the oath');
    this.skipButton.focus({ preventScroll: true }); this.update(0); return true;
  }
  skip() { if (!this.active) { this.onPendingSkip(); return; } if (this.skipElapsed === null) this.skipElapsed = 0; }
  finish() { this.active = false; this.panel.hidden = true; this.onFinish(this.kind); }
  update(dt) {
    if (!this.active) return;
    if (this.skipElapsed !== null) {
      this.skipElapsed += dt;
      if (this.skipElapsed >= .35) { this.finish(); return; }
    }
    this.elapsed += dt;
    const shot = storyTimeline(this.scenes, this.elapsed);
    if (shot.done) { this.finish(); return; }
    const scene = this.scenes[shot.index];
    if (shot.index !== this.lastScene) { this.lastScene = shot.index; this.announce([scene.caption, scene.translation].filter(Boolean).join(' ')); }
    this.draw(scene, shot);
  }
  draw(scene, shot) {
    const g = this.ctx; g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.fillStyle = '#050810'; g.fillRect(0, 0, 512, 288);
    const background = this.images.get(scene.background);
    if (background) g.drawImage(background, 0, 0, 512, ['tower','lightning'].includes(scene.id) ? 248 : 288);
    const effects = { ...this.manifest?.effects, ...scene.effects };
    if (scene.id === 'oath') this.drawTraining(scene, effects, shot.local);
    const staging = scene.staging || {};
    const animation = staging.static ? null : scene.animation, actor = this.images.get(animation?.src || scene.actor);
    if (actor) {
      const fw = animation?.frameWidth || actor.width, fh = animation?.frameHeight || actor.height;
      // A training strike occurs once per power cycle; walking loops its feet without restarting position.
      const frame = animationFrame(animation, scene.id === 'golden_fist' ? shot.local % 2.8 : shot.local, scene.id === 'golden_fist' ? false : scene.loop);
      const columns = Math.max(1, Math.floor(actor.width / fw));
      const sx = (frame % columns) * fw, sy = Math.floor(frame / columns) * fh;
      // Every pose uses the same cell and feet pivot. No frame-dependent trimming or drift.
      const size = staging.size || (scene.id === 'oath' ? 288 : 224);
      const y = scene.id === 'oath' ? 244-size : Math.round((staging.groundY || 236) - (staging.anchorY || 222) * size / fh);
      const drawActor = (x, alpha = 1) => { g.globalAlpha = alpha; g.drawImage(actor, sx, sy, fw, fh, Math.round(x - size / 2), y, size, size); g.globalAlpha = 1; };
      drawActor(scene.id === 'tower' ? 220 + Math.min(36, shot.local * 5) : staging.x || 256);
    }
    if (scene.id !== 'oath') this.drawTraining(scene, effects, shot.local);
    if (scene.id === 'village_burning') this.drawMonsterShot(effects.fire_shot, shot.local);
    g.fillStyle = '#050810'; g.fillRect(0, 248, 512, 40);
    const caption = bitmapLines(scene.caption || '', 76), translation = scene.translation ? bitmapLines(scene.translation, 76) : [];
    const lines = [...caption.map(text => [text, '#F1D078']), ...translation.map(text => [text, '#F3E7C9'])];
    lines.slice(0, 3).forEach(([text, color], i) => pixelText(g, text, Math.round((512 - text.length * 6) / 2), 254 + i * 10, color));
    const visibility = this.skipElapsed === null ? shot.visibility : Math.min(shot.visibility, 1 - this.skipElapsed / .35);
    g.fillStyle = `rgba(0,0,0,${1 - visibility})`; g.fillRect(0, 0, 512, 288);
  }
  drawFire(effect, seconds) {
    const image = this.images.get(effect?.src); if (!image) return;
    const g = this.ctx, fw = effect.frameWidth || 128, fh = effect.frameHeight || 192;
    const columns = Math.max(1, Math.floor(image.width / fw));
    for (const [x, bottom, size, delay] of [[345, 75, 64, 0], [438, 80, 48, .3]]) {
      const frame = animationFrame(effect, seconds + delay, true);
      g.drawImage(image, frame % columns * fw, Math.floor(frame / columns) * fh, fw, fh, x, bottom - size * fh / fw, size, size * fh / fw);
    }
  }
  drawMonsterShot(effect, seconds) {
    const image = this.images.get(effect?.src); if (!image) return;
    const cycle = seconds % 1.8, progress = (cycle - .25) / .85;
    if (progress < 0 || progress > 1) return;
    const x = 278 + progress * 134, y = 193 - progress * 78;
    this.ctx.drawImage(image, Math.round(x), Math.round(y), 48, 24);
  }
  drawTraining(scene, effects, seconds) {
    const timing = trainingEffect(seconds), g = this.ctx;
    if (scene.id === 'golden_fist') {
      const image = this.images.get(effects.golden_fist?.src);
      if (image && timing.visible) {
        const height = 188, width = Math.round(height * image.width / image.height);
        const bottom = Math.round(-20 + timing.drop * 264);
        g.drawImage(image, 380 - Math.round(width / 2), bottom - height, width, height);
        if (timing.impact) { g.fillStyle = '#F1D078'; for (let i = 0; i < 7; i++) g.fillRect(330 + i * 16, 238 - (i % 2) * 4, 8, 4); }
      }
    }
    if (scene.id === 'lightning' || scene.id === 'oath') {
      const image = this.images.get(effects.lightning?.src);
      if (image && timing.impact) {
        const height = scene.id === 'oath' ? 212 : 240;
        const width = Math.round(height * image.width / image.height);
        for (const x of scene.id === 'oath' ? [82, 430] : [100, 410]) g.drawImage(image, x - Math.round(width / 2), 244 - height, width, height);
      }
      if (image && timing.flash) { g.globalAlpha = .12; g.fillStyle = '#F3E7C9'; g.fillRect(0, 0, 512, 248); g.globalAlpha = 1; }
    }
    if (scene.id === 'legion') {
      const effect = effects.legion, image = this.images.get(effect?.src);
      if (!image) return;
      const fw = effect.frameWidth || 256, fh = effect.frameHeight || 256, columns = Math.max(1, Math.floor(image.width / fw));
      const cycle = seconds % 3.2, fade = Math.min(clamp(cycle / .4), clamp((3.2 - cycle) / .5));
      const size = 200;
      const y = Math.round((effect.groundY || 228) - (effect.anchorY || 171) * size / fh);
      for (const [x, delay] of [[92, 0], [420, .12]]) {
        const frame = animationFrame(effect, Math.max(0, cycle - .45 - delay), false);
        g.globalAlpha = fade * .82;
        g.drawImage(image, frame % columns * fw, Math.floor(frame / columns) * fh, fw, fh, x - size / 2, y, size, size);
      }
      g.globalAlpha = 1;
    }
  }
}
