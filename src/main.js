import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { AudioSystem } from './audio.js';
import { drawPixelHud } from './pixel-hud.js';
import { installArcadeBoot } from './arcade-boot.js';
import { installPixelInterface, setPixelInterfaceText } from './pixel-interface.js';
import { StoryPlayer } from './story-player.js';
import { CreditsPlayer } from './credits-player.js';

const $ = id => document.getElementById(id);
function fadeIntoGame() {
  const overlay = $('game-entry-fade'); if (!overlay) return;
  overlay.classList.remove('is-entering');
  void overlay.offsetWidth;
  overlay.classList.add('is-entering');
}
const params = new URLSearchParams(location.search);
const reviewMode = params.has('review') || params.has('story') || params.has('credits');
const SAVE = 'bruto.save.v1', BEST = 'bruto.best.v1', SETTINGS = 'bruto.settings.v1';
const storage = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { if(reviewMode && key !== SETTINGS)return;try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
  remove(key) { if(reviewMode)return;try { localStorage.removeItem(key); } catch {} }
};
const settings = storage.get(SETTINGS, { muted: false, music: true, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
if (settings.audioDefaultsVersion !== 2) { settings.muted = false; settings.music = true; settings.audioDefaultsVersion = 2; }
settings.crt ??= true;
if (settings.crtDefaultsVersion !== 1) {
  settings.crt = true; settings.crtClassic = true; settings.crtDefaultsVersion = 1;
}
settings.crtClassic ??= true;
const audio = new AudioSystem({ muted: settings.muted, musicEnabled: settings.music, volume: 0.5 });
const renderer = new Renderer($('game-canvas'));
renderer.setOptions({ reducedMotion: settings.reducedMotion });
let best = Number(storage.get(BEST, 0)) || 0;
let lastState = '', previousTime = 0, lastHUDTime = 0, saveTime = 0, deathPresented = false;
let guideOpen = false, guideResume = false, gamepadConnected = false;
let optionsOpen = false, optionsResume = false, optionsFocus = null;
let touchEnabled = matchMedia('(pointer: coarse)').matches;
let currentInput = {}, pressed = {}, gamepadPrevious = {}, returnFocus = null, newRecord = false;
let reviewFrozen = () => false;
let storyPending = false, endingHandled = false, storyRequest = 0, storyPendingKind = 'intro';
const keys = new Set(), touch = new Set();
const mappings = {
  ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right', ArrowUp:'up', KeyW:'up', ArrowDown:'down', KeyS:'down',
  Space:'jump', KeyJ:'attack', KeyK:'heavy', KeyL:'dash', ShiftLeft:'dash', ShiftRight:'dash', KeyQ:'special', KeyI:'defend', KeyZ:'magicFist', KeyX:'magicStorm', KeyC:'magicLegion'
};
const actions = new Set(['jump','attack','heavy','dash','special','magicFist','magicStorm','magicLegion']);

function announce(message) { if ($('live-announcement')) $('live-announcement').textContent = message; }
function saveProgress() {
  if (storyPending || story.active || credits.active) return;
  if (typeof game.exportSave === 'function' && game.state !== 'won') {
    const data = game.exportSave();
    if (data) storage.set(SAVE, data);
  }
}
function onEvent(event) {
  audio.play(event.sound || event.type, event);
  if (event.type === 'arenaClear' && !story.active && !credits.active) audio.setScene('playing');
  if (['checkpoint','stage','boss','win','victory','death'].includes(event.type)) {
    if (event.message || event.text) announce(event.message || event.text);
    if (event.type === 'boss') audio.setScene('boss');
    if (['checkpoint','stage'].includes(event.type)) queueMicrotask(saveProgress);
  }
}
const game = new Game({ onEvent });
const credits = new CreditsPlayer({panel:$('credits-screen'),canvas:$('credits-canvas'),skipButton:$('skip-credits-button'),announce,
  onFinish:() => { clearInput(); syncScreens(true); updateHUD(); fadeIntoGame(); }});
function showCredits() { clearInput(); credits.start(); audio.resume(); audio.setScene('credits'); syncScreens(true); }
const story = new StoryPlayer({ panel:$('story-screen'), canvas:$('story-canvas'), skipButton:$('skip-story-button'), announce,
  onFinish:kind => { if(kind==='ending'){showCredits();return;} clearInput(); syncScreens(true); updateHUD(); fadeIntoGame(); },
  onPendingSkip:() => { if (!storyPending) return; storyRequest++; storyPending = false; $('story-screen').hidden = true; if(storyPendingKind==='ending'){showCredits();return;} clearInput(); syncScreens(true); fadeIntoGame(); }
});
async function playStory(kind, singleScene = null) {
  const request = ++storyRequest;
  storyPendingKind = kind;
  storyPending = true; clearInput(); syncScreens(true);
  story.prepare(kind);
  const available = await story.load();
  if (request !== storyRequest) return false;
  storyPending = false;
  if (available && story.start(kind, singleScene)) {
    audio.setScene(kind === 'ending' ? 'ending' : 'intro'); syncScreens(true); return true;
  }
  $('story-screen').hidden = true; if(kind==='ending')showCredits();else syncScreens(true); return false;
}

function setVisible(id, visible) { const el = $(id); if (el) el.hidden = !visible; }
function put(id, value) { const el = $(id); if (el && el.textContent !== String(value) && !setPixelInterfaceText(el,value)) el.textContent = value; }
function fill(id, amount) { const el = $(id); if (el) el.style.width = `${Math.max(0, Math.min(100, amount || 0))}%`; }
function clearInput() { keys.clear(); touch.clear(); pressed = {}; currentInput = {}; gamepadPrevious = {}; }
function formatTime(seconds) { return `${Math.floor(seconds / 60).toString().padStart(2,'0')}:${Math.floor(seconds % 60).toString().padStart(2,'0')}`; }
function updateSettings() {
  storage.set(SETTINGS, settings);
  audio.setMuted(settings.muted); audio.setMusicEnabled(settings.music);
  renderer.setOptions({ reducedMotion: settings.reducedMotion });
  document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
  document.documentElement.classList.toggle('crt-off', !settings.crt);
  document.documentElement.classList.toggle('crt-classic-preview', settings.crt && settings.crtClassic);
  for (const id of ['sound-button','menu-sound-button']) {
    $(id)?.classList.toggle('muted', settings.muted);
    $(id)?.setAttribute('aria-pressed', String(!settings.muted));
    $(id)?.setAttribute('aria-label', settings.muted ? 'Enable sound' : 'Mute sound');
  }
  if ($('music-toggle')) $('music-toggle').checked = settings.music;
  if ($('motion-toggle')) $('motion-toggle').checked = settings.reducedMotion;
  if ($('options-sound-toggle')) $('options-sound-toggle').checked = !settings.muted;
  if ($('options-music-toggle')) $('options-music-toggle').checked = settings.music;
  if ($('options-motion-toggle')) $('options-motion-toggle').checked = settings.reducedMotion;
  if ($('crt-toggle')) $('crt-toggle').checked = settings.crt;
  if ($('crt-classic-toggle')) $('crt-classic-toggle').checked = settings.crtClassic;
}
function syncScreens(force = false) {
  const state = game.state;
  if (story.active || storyPending || credits.active) {
    for (const id of ['menu-screen','hud','pause-screen','gameover-screen','victory-screen','touch-controls','message-toast','boss-hud','combo-display']) setVisible(id,false);
    $('game-shell').classList.remove('is-playing');
    return;
  }
  if (state === 'won' && !endingHandled) { endingHandled = true; void playStory('ending'); return; }
  if (state === lastState && !force) return;
  const previousState = lastState; lastState = state; clearInput();
  if (state === 'playing' && ['menu','dead'].includes(previousState)) fadeIntoGame();
  $('game-shell').dataset.state = state;
  $('game-shell').classList.toggle('is-playing', state === 'playing');
  for (const [id, visible] of Object.entries({
    'menu-screen':state === 'menu', 'hud':state !== 'menu', 'pause-screen':state === 'paused',
    'gameover-screen':state === 'dead' && game.player.animTime >= 1.1, 'victory-screen':state === 'won',
    'touch-controls':touchEnabled && state === 'playing', 'continue-button':Boolean(storage.get(SAVE,null))
  })) setVisible(id, visible);
  if (state === 'playing') {
    audio.resume(); audio.setScene(game.boss && !game.boss.dead ? 'boss' : 'playing');
    $('game-canvas').focus({ preventScroll: true });
  } else if (state === 'paused') {
    audio.suspend(); saveProgress(); $('resume-button')?.focus({ preventScroll: true });
  } else if (state === 'menu') {
    audio.resume(); audio.setScene('menu'); $('start-button')?.focus({ preventScroll: true });
  } else if (state === 'dead' || state === 'won') {
    const score = Math.floor(game.score || 0);
    newRecord = score > best;
    if (newRecord) { best = score; storage.set(BEST, best); }
    const prefix = state === 'won' ? 'victory' : 'death';
    put(`${prefix}-score`, score.toLocaleString('es-ES')); put(`${prefix}-kills`, game.kills || 0); put(`${prefix}-combo`, `${game.maxCombo || 0}×`);
    if (state === 'won') {
      storage.remove(SAVE);
      put('victory-time', formatTime(game.elapsed ?? game.time));
      put('victory-rank', (game.maxCombo || 0) >= 25 ? 'S' : (game.maxCombo || 0) >= 12 ? 'A' : 'B');
      setVisible('new-record', newRecord);
    }
    audio.resume(); audio.setScene(state); audio.play(state === 'won' ? 'win' : 'death');
    announce(state === 'won' ? 'The king is defeated. The crown is yours.' : 'Brutus has fallen. Retry from the last checkpoint.');
    $(state === 'won' ? 'play-again-button' : 'retry-button')?.focus({ preventScroll: true });
  }
  put('best-value', best.toLocaleString('es-ES'));
}

async function start(continuing = false) {
  if (story.active || storyPending || credits.active) return;
  optionsOpen=false;setVisible('options-screen',false);
  await audio.unlock(); guideOpen = false; setVisible('guide-screen',false);
  const saved = continuing && storage.get(SAVE,null);
  let loaded = false;
  if (saved && typeof game.importSave === 'function') {
    try { loaded = game.importSave(saved) !== false; } catch { storage.remove(SAVE); }
  }
  endingHandled = false;
  if (!loaded) game.start();
  if (game.state === 'paused') game.resume();
  newRecord = false; saveTime = 0; syncScreens(true); updateHUD();
  if (!loaded && !continuing) await playStory('intro');
}
function pause() { if (!story.active && !storyPending && !credits.active && game.state === 'playing') { game.pause(); syncScreens(); } }
async function resume() { await audio.unlock(); if (game.state === 'paused') game.resume(); syncScreens(); }
async function retry() {
  await audio.unlock();
  if (typeof game.retryCheckpoint === 'function') game.retryCheckpoint();
  else {
    const saved = storage.get(SAVE,null);
    if (saved && typeof game.importSave === 'function') { try { if (game.importSave(saved) === false) game.restart(); } catch { game.restart(); } }
    else game.restart();
  }
  syncScreens(true);
}
function menu() { saveProgress(); guideOpen = false; setVisible('guide-screen', false); game.state = 'menu'; syncScreens(true); }
function openGuide() {
  returnFocus = document.activeElement; guideResume = game.state === 'playing';
  if (guideResume) pause();
  guideOpen = true; setVisible('guide-screen', true); $('close-guide-button')?.focus(); clearInput();
}
function closeGuide() { guideOpen = false; setVisible('guide-screen', false); if (guideResume) resume(); else returnFocus?.focus(); }
function openOptions() { optionsFocus=document.activeElement;optionsResume=game.state==='playing';if(optionsResume)pause();optionsOpen=true;clearInput();setVisible('options-screen',true);$('options-sound-toggle')?.focus(); }
function closeOptions() { optionsOpen=false;setVisible('options-screen',false);if(optionsResume)resume();else optionsFocus?.focus();clearInput(); }
function bind(id, fn) { $(id)?.addEventListener('click', fn); }
bind('start-button', () => start()); bind('continue-button', () => start(true));
bind('pause-button', pause); bind('resume-button', resume);
bind('pause-restart-button', () => start()); bind('retry-button', retry); bind('play-again-button', () => start());
for (const id of ['pause-menu-button','death-menu-button','victory-menu-button']) bind(id,menu);
for (const id of ['menu-guide-button','pause-guide-button']) bind(id,openGuide);
bind('close-guide-button', closeGuide);
bind('menu-options-button',openOptions);bind('pause-options-button',openOptions);bind('close-options-button',closeOptions);
bind('menu-credits-button',showCredits);
for (const id of ['sound-button','menu-sound-button']) bind(id, async () => { await audio.unlock(); settings.muted = !settings.muted; updateSettings(); });
$('music-toggle')?.addEventListener('change',event => { settings.music = event.target.checked; updateSettings(); });
$('motion-toggle')?.addEventListener('change',event => { settings.reducedMotion = event.target.checked; updateSettings(); });
$('options-sound-toggle')?.addEventListener('change',async event=>{settings.muted=!event.target.checked;await audio.unlock();updateSettings();});
$('options-music-toggle')?.addEventListener('change',async event=>{settings.music=event.target.checked;await audio.unlock();updateSettings();});
$('options-motion-toggle')?.addEventListener('change',event=>{settings.reducedMotion=event.target.checked;updateSettings();});
$('crt-toggle')?.addEventListener('change',event=>{settings.crt=event.target.checked;updateSettings();});
$('crt-classic-toggle')?.addEventListener('change',event=>{settings.crtClassic=event.target.checked;if(settings.crtClassic)settings.crt=true;updateSettings();});
bind('fullscreen-button', () => document.fullscreenElement ? document.exitFullscreen?.() : $('arcade-machine').requestFullscreen?.().catch(()=>{}));

document.addEventListener('keydown', event => {
  if (credits.active) {
    if (event.code === 'KeyM' && !event.repeat) { settings.muted = !settings.muted; updateSettings(); }
    else if (['Enter','Escape','Space'].includes(event.code)) { event.preventDefault(); if(!event.repeat)credits.skip(); }
    else if (event.code === 'Tab') { event.preventDefault(); $('skip-credits-button').focus(); }
    else if (mappings[event.code] || event.code === 'KeyP') event.preventDefault();
    return;
  }
  if (story.active || storyPending || credits.active) {
    if (event.code === 'KeyM' && !event.repeat) { settings.muted = !settings.muted; updateSettings(); }
    else if (['Enter','Escape','Space'].includes(event.code)) { event.preventDefault(); if (!event.repeat) story.skip(); }
    else if (event.code === 'Tab') { event.preventDefault(); $('skip-story-button').focus(); }
    else if (mappings[event.code] || event.code === 'KeyP') event.preventDefault();
    return;
  }
  if (event.code === 'Tab') {
    const screen = optionsOpen ? $('options-screen') : guideOpen ? $('guide-screen') : game.state === 'paused' ? $('pause-screen') : null;
    if (screen) {
      const focusables = [...screen.querySelectorAll('button:not([hidden]),input:not([hidden])')];
      const first = focusables[0], last = focusables.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    return;
  }
  if (event.code === 'Escape' || event.code === 'KeyP') {
    if (event.repeat) return;
    event.preventDefault(); if(optionsOpen)closeOptions();else if (guideOpen) closeGuide(); else if (game.state === 'paused') resume(); else pause(); return;
  }
  if (event.code === 'KeyM' && !event.repeat && !guideOpen) { settings.muted = !settings.muted; updateSettings(); return; }
  const action = mappings[event.code];
  if (!action || game.state !== 'playing' || guideOpen || optionsOpen) return;
  event.preventDefault();
  if (actions.has(action) && !keys.has(event.code)) pressed[action] = true;
  keys.add(event.code);
});
document.addEventListener('keyup', event => { keys.delete(event.code); });
window.addEventListener('blur', () => { clearInput(); pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); audio.suspend(); } else if(story.active || credits.active)audio.resume(); });
document.addEventListener('pointerdown', () => { void audio.unlock(); }, {once:true,capture:true});
document.addEventListener('keydown', () => { void audio.unlock(); }, {once:true,capture:true});
window.addEventListener('beforeunload', saveProgress);
document.querySelectorAll('[data-input]').forEach(button => {
  const action = button.dataset.input;
  button.addEventListener('pointerdown', event => {
    if (story.active || storyPending || credits.active) return;
    event.preventDefault(); button.setPointerCapture(event.pointerId); touchEnabled = true;
    if (actions.has(action)) pressed[action] = true; else touch.add(action);
    button.classList.add('pressed');
  });
  const release = () => { touch.delete(action); button.classList.remove('pressed'); };
  for (const name of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(name,release);
});
document.addEventListener('pointerdown', event => { if (event.pointerType === 'touch' && !touchEnabled) { touchEnabled = true; syncScreens(true); } }, { passive: true });

function getInput() {
  const input = { left:false,right:false,up:false,down:false,jump:false,attack:false,heavy:false,dash:false,special:false,defend:false,magicFist:false,magicStorm:false,magicLegion:false, ...pressed };
  pressed = {};
  for (const key of keys) { const action = mappings[key]; if (!actions.has(action)) input[action] = true; }
  for (const action of touch) input[action] = true;
  const pad = [...(navigator.getGamepads?.() || [])].find(p => p?.connected);
  if (pad) {
    if (!gamepadConnected) { gamepadConnected = true; put('input-hint','STICK MOVE · A JUMP · X/Y ATTACK · LB GUARD · B DODGE · RB RAGE'); }
    const now = {jump:pad.buttons[0]?.pressed,attack:pad.buttons[2]?.pressed,heavy:pad.buttons[3]?.pressed,dash:pad.buttons[1]?.pressed,special:pad.buttons[5]?.pressed,pause:pad.buttons[9]?.pressed};
    if(pad.buttons[7]?.pressed){now.magicFist=now.attack;now.magicStorm=now.heavy;now.magicLegion=now.jump;now.attack=false;now.heavy=false;now.jump=false;}
    input.defend ||= Boolean(pad.buttons[4]?.pressed || pad.buttons[6]?.pressed);
    input.left ||= pad.axes[0] < -0.25 || pad.buttons[14]?.pressed;
    input.right ||= pad.axes[0] > 0.25 || pad.buttons[15]?.pressed;
    input.up ||= pad.axes[1] < -0.4 || pad.buttons[12]?.pressed;
    input.down ||= pad.axes[1] > 0.4 || pad.buttons[13]?.pressed;
    for (const action of actions) input[action] ||= Boolean(now[action] && !gamepadPrevious[action]);
    if (now.pause && !gamepadPrevious.pause) { if(optionsOpen)closeOptions();else if (game.state === 'playing') pause(); else if (game.state === 'paused') resume(); }
    gamepadPrevious = now;
  } else if (gamepadConnected) {
    gamepadConnected = false; gamepadPrevious = {}; put('input-hint','A/D MOVE · SPACE JUMP · J/K SWORD · HOLD I GUARD');
  }
  return input;
}

function updateHUD() {
  if (story.active || storyPending || credits.active) return;
  const p = game.player;
  if (!p) return;
  const hp = Math.max(0,Math.ceil(p.hp)), maxHp = p.maxHp || 100, rage = Math.max(0,Math.floor(p.rage || 0));
  fill('health-fill',hp/maxHp*100); put('health-value',`${hp} / ${maxHp}`);
  $('health-meter')?.setAttribute('aria-valuenow',String(hp)); $('health-meter')?.setAttribute('aria-valuemax',String(maxHp));
  fill('rage-fill',rage); put('rage-value', rage >= 100 ? 'RAGE READY!' : `${rage}%`);
  $('rage-meter')?.setAttribute('aria-valuenow',String(rage)); $('rage-meter')?.classList.toggle('is-ready',rage >= 100);
  put('score-value',Math.floor(game.score || 0).toLocaleString('es-ES'));
  setVisible('combo-display',game.combo >= 2 && game.state !== 'menu');
  put('combo-value',game.combo || 0); put('combo-title',game.combo >= 20 ? 'BRUTAL' : game.combo >= 10 ? 'SAVAGE' : 'COMBO');
  fill('combo-fill',(game.comboTimer || 0)/(game.comboDuration || 3)*100);
  const stageIndex = Math.max(0,Math.min(4,(game.stage || 1)-1));
  put('stage-number',`ACT ${['I','II','III','IV','V'][stageIndex]}`); put('stage-name',game.stageName || 'SUNSET RUINS');
  put('checkpoint-label',game.stageName || 'SUNSET RUINS'); fill('stage-progress',p.x/(game.levelWidth || 7200)*100);
  const boss = game.boss;
  setVisible('boss-hud', Boolean(boss && !boss.dead && boss.hp > 0 && game.state !== 'menu'));
  if (boss) { const percent = boss.hp/boss.maxHp*100; fill('boss-health-fill',percent); put('boss-health-value',`${Math.max(0,Math.ceil(percent))}%`); put('boss-name', boss.name || 'GORGOR · KING OF HUNGER'); }
  const showMessage = Boolean(game.message && game.messageTimer > 0 && game.state === 'playing');
  setVisible('message-toast',showMessage); if (showMessage) put('message-text',game.message);
}

function frame(now) {
  const dt = Math.min(0.04, Math.max(0,(now - previousTime)/1000)); previousTime = now;
  currentInput = story.active || storyPending || credits.active ? {} : getInput();
  if (!story.active && !storyPending && !credits.active && !guideOpen && !optionsOpen && !reviewFrozen()) game.update(dt,currentInput);
  const storyReviewHold = params.has('story') && params.has('scene') && params.has('hold') && story.skipElapsed === null;
  credits.update(document.hidden ? 0 : dt);
  story.update(document.hidden ? 0 : storyReviewHold ? Math.min(dt, Math.max(0, 2.2 - story.elapsed)) : dt);
  renderer.render(game,dt); drawPixelHud(renderer.ctx,game,{portrait:renderer.images.hero_portrait}); syncScreens();
  if(game.state==='dead' && game.player.animTime>=1.1 && !deathPresented){deathPresented=true;setVisible('gameover-screen',true);$('retry-button')?.focus();}
  if(game.state!=='dead')deathPresented=false;
  if (now - lastHUDTime > 70) { updateHUD(); lastHUDTime = now; }
  if (game.state === 'playing' && !story.active && !storyPending && !credits.active) { saveTime += dt; if (saveTime > 8) { saveProgress(); saveTime = 0; } }
  requestAnimationFrame(frame);
}

updateSettings(); syncScreens(true);
installPixelInterface();
installArcadeBoot({skip:reviewMode,onFinish:fadeIntoGame});
try { await renderer.load(); put('loading-label','One kingdom. One sword. Zero manners.'); }
catch (error) { console.warn('Some assets could not load:',error.message); put('loading-label','The kingdom is ready. Let chaos begin.'); }
if (new URLSearchParams(location.search).has('debug')) window.__BRUTO__ = { game, renderer, audio, snapshot:() => game.snapshot(), start, pause, resume };
if (new URLSearchParams(location.search).has('review')) {
  const { installCombatReview } = await import('./combat-review.js');
  reviewFrozen = installCombatReview(game);
}
if (params.has('credits')) {
  game.start(); endingHandled = true; reviewFrozen = () => true; showCredits();
}
if (params.has('story')) {
  game.start(); endingHandled = true;
  reviewFrozen = () => true;
  await playStory(params.get('story') === 'ending' ? 'ending' : 'intro', params.get('scene'));
}
requestAnimationFrame(time => { previousTime = time; requestAnimationFrame(frame); });
