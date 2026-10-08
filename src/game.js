/** BRUTUS — deterministic, dependency-free arcade simulation. Coordinates use feet. */
export const WORLD = Object.freeze({ width: 7800, height: 540, floor: 450, gravity: 1900 });

export const ATTACKS = Object.freeze({
  light: [
    { duration: .31, start: .07, end: .20, damage: 20, range: 100, knock: 120, stun: .20 },
    { duration: .34, start: .08, end: .24, damage: 25, range: 112, knock: 150, stun: .24 },
    { duration: .46, start: .13, end: .32, damage: 36, range: 134, knock: 340, stun: .46 },
  ],
  heavy: { duration: .68, start: .23, end: .43, damage: 47, range: 125, knock: 170, stun: .65, launch: 470 },
  airattack: { duration: .40, start: .06, end: .29, damage: 29, range: 116, knock: 190, stun: .30, launch: 190 },
  special: { duration: .84, start: .15, end: .62, damage: 88, range: 265, knock: 490, stun: 1.0, launch: 240 },
});

const ENEMY = {
  zombie: { w: 32, h: 58, hp: 65, speed: 81, damage: 10, reach: 66, windup: .69, cooldown: 1.35, score: 100 },
  skeleton: { w: 29, h: 60, hp: 51, speed: 125, damage: 9, reach: 79, windup: .51, cooldown: 1.17, score: 140 },
  ogre: { w: 66, h: 94, hp: 175, speed: 65, damage: 19, reach: 109, windup: .94, cooldown: 1.9, score: 320 },
  boss: { w: 83, h: 125, hp: 1200, speed: 98, damage: 22, reach: 151, windup: .82, cooldown: 1.45, score: 3000 },
  ghost: { w: 30, h: 54, hp: 48, speed: 125, damage: 11, reach: 88, windup: .56, cooldown: 1.25, score: 170 },
  half_zombie: { w: 28, h: 56, hp: 44, speed: 105, damage: 9, reach: 61, windup: .52, cooldown: 1.08, score: 130 },
  vampire: { w: 38, h: 76, hp: 130, speed: 158, damage: 16, reach: 104, windup: .62, cooldown: 1.45, score: 410 },
  demon: { w: 40, h: 72, hp: 95, speed: 145, damage: 14, reach: 105, windup: .56, cooldown: 1.35, score: 330 },
  witch: { w: 42, h: 72, hp: 88, speed: 105, damage: 15, reach: 480, windup: .76, cooldown: 1.7, score: 380 },
  raven_orc: { w: 72, h: 105, hp: 440, speed: 74, damage: 25, reach: 135, windup: 1.0, cooldown: 2.2, score: 1100 },
  bone_king: { w: 105, h: 155, hp: 1650, speed: 74, damage: 28, reach: 170, windup: 1.0, cooldown: 1.8, score: 4500 },
};

const ARENAS = [
  { id: 0, left: 350, right: 1030, name: 'FIRST BLOOD', waves: [['zombie', 'half_zombie'], ['ghost', 'skeleton']] },
  { id: 1, left: 1280, right: 2000, name: 'THE RUIN WARLORD', waves: [['skeleton', 'half_zombie'], ['raven_orc']], boss: true, bossId: 'warlord' },
  { id: 2, left: 2440, right: 3080, name: 'BONE THRONE', waves: [['ghost', 'skeleton'], ['bone_king']], boss: true, bossId: 'bone_king' },
  { id: 3, left: 3290, right: 4010, name: 'THE SWAMP QUEEN', waves: [['half_zombie', 'witch'], ['witch']], boss: true, bossId: 'swamp_queen' },
  { id: 4, left: 4250, right: 4930, name: 'DARK WOOD AMBUSH', waves: [['raven_orc', 'demon'], ['ogre', 'witch']] },
  { id: 5, left: 5320, right: 5900, name: 'THE ASH DEVIL', waves: [['demon']], boss: true, bossId: 'ash_devil' },
  { id: 6, left: 6100, right: 6630, name: 'GORGOR · KING OF HUNGER', waves: [['boss']] },
  { id: 7, left: 6800, right: 7580, name: 'THE CRIMSON COUNTESS', waves: [['vampire']], boss: true, bossId: 'countess' },
];

const STAGES = ['I · SUNSET RUINS', 'II · THE GRAVEYARD', 'III · THE POISON SWAMP', 'IV · THE DARK WOOD', 'V · THE ABANDONED VILLAGE'];
const BOSSES = {
  warlord: { name: 'KARG · THE RAVEN WARLORD', hp: 720, scale: 1.2 },
  bone_king: { name: 'MORGRAVE · THE BONE KING', hp: 1050, scale: 1 },
  swamp_queen: { name: 'BELLADONNA · THE SWAMP QUEEN', hp: 1200, scale: 1.5 },
  ash_devil: { name: 'AZRAK · THE ASH DEVIL', hp: 1450, scale: 1.7 },
  countess: { name: 'VESPERA · THE CRIMSON COUNTESS', hp: 1800, scale: 1.6 },
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const body = actor => ({ x: actor.x - actor.w / 2, y: actor.y - actor.h, w: actor.w, h: actor.h });

export class Game {
  constructor({ onEvent = () => {}, seed = 5731 } = {}) {
    this.onEvent = onEvent;
    this.seed = seed;
    this._reset();
    this.state = 'menu';
  }

  _reset() {
    this._rng = this.seed >>> 0;
    this._id = 0;
    this.state = 'playing';
    this.time = 0;
    this.camera = 0;
    this.levelWidth = WORLD.width;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.stage = 1;
    this.stageName = STAGES[0];
    this.shake = 0;
    this.flash = 0;
    this.hitstop = 0;
    this.message = 'VAE VICTIS! THE SWORD IS HUNGRY.';
    this.messageTimer = 4.5;
    this.enemies = [];
    this.particles = [];
    this.projectiles = [];
    this.magicEffect = null;
    this.props = [
      { type: 'barrel', x: 320 }, { type: 'tree', x: 960 }, { type: 'barrel', x: 1200 },
      { type: 'pipe', x: 1920 }, { type: 'barrel', x: 2600 }, { type: 'tree', x: 3350 },
      { type: 'barrel', x: 4020 }, { type: 'tree', x: 4750 }, { type: 'pipe', x: 5550 },
      { type: 'barrel', x: 6350 }, { type: 'tree', x: 7080 },
    ].map(prop => ({ ...prop, id: ++this._id, y: WORLD.floor, w: prop.type === 'tree' ? 60 : prop.type === 'barrel' ? 56 : 40, h: prop.type === 'tree' ? 320 : prop.type === 'barrel' ? 80 : 120, hp: prop.type === 'tree' ? 70 : 30, maxHp: prop.type === 'tree' ? 70 : 30, broken: false }));
    this.boss = null;
    this.arena = null;
    this.arenas = ARENAS.map(a => ({ ...a, waves: a.waves.map(w => [...w]), cleared: false, started: false, wave: 0, nextWave: 0 }));
    this.gates = this.arenas.map(a => ({ x: a.right, active: false }));
    this.platforms = [
      { x: 0, y: 450, w: 2100, h: 120, type: 'ground' },
      { x: 2220, y: 450, w: 2830, h: 120, type: 'ground' },
      { x: 5180, y: 450, w: 1520, h: 120, type: 'ground' },
      { x: 6770, y: 450, w: 1030, h: 120, type: 'ground' },
      { x: 590, y: 345, w: 170, h: 22, type: 'ledge' },
      { x: 1460, y: 339, w: 170, h: 24, type: 'stone' },
      { x: 1870, y: 319, w: 155, h: 22, type: 'ledge' },
      { x: 2140, y: 365, w: 64, h: 24, type: 'stone' },
      { x: 2600, y: 334, w: 172, h: 24, type: 'ledge' },
      { x: 3500, y: 350, w: 165, h: 22, type: 'stone' },
      { x: 3870, y: 285, w: 130, h: 22, type: 'ledge' },
      { x: 4500, y: 342, w: 175, h: 24, type: 'stone' },
      { x: 5080, y: 361, w: 70, h: 24, type: 'stone' },
      { x: 5480, y: 330, w: 158, h: 22, type: 'ledge' },
      { x: 6310, y: 337, w: 165, h: 24, type: 'stone' },
      { x: 6960, y: 328, w: 135, h: 24, type: 'ledge' },
      { x: 7370, y: 328, w: 135, h: 24, type: 'ledge' },
    ];
    this.pickups = [
      ...[675, 1535, 1945, 2680, 3570, 3935, 4580, 5555, 6390].map((x, i) => ({
        id: ++this._id, x, y: [306, 301, 281, 296, 312, 247, 304, 292, 299][i], type: i % 3 === 1 ? 'rage' : 'coin', phase: i,
      })),
      { id: ++this._id, x: 2320, y: 416, type: 'meat', phase: 0 },
      { id: ++this._id, x: 5250, y: 416, type: 'meat', phase: 2 },
      { id: ++this._id, x: 6778, y: 405, type: 'meat', phase: 1 },
      { id: ++this._id, x: 1120, y: 416, type: 'green_potion', phase: 1 },
      { id: ++this._id, x: 1850, y: 416, type: 'red_potion', phase: 2 },
      { id: ++this._id, x: 4200, y: 416, type: 'mana_fist', phase: 1 },
      { id: ++this._id, x: 5550, y: 416, type: 'mana_storm', phase: 2 },
      { id: ++this._id, x: 6400, y: 416, type: 'mana_legion', phase: 3 },
      { id: ++this._id, x: 3860, y: 416, type: 'club', phase: 0 },
    ];
    this.player = {
      id: ++this._id, type: 'hero', x: 125, y: 450, w: 38, h: 130, vx: 0, vy: 0, facing: 1,
      hp: 100, maxHp: 100, rage: 25, state: 'idle', animTime: 0, attackTimer: 0,
      invulnerable: 0, dead: false, grounded: true, jumpsUsed: 0, coyote: .11, jumpBuffer: 0,
      dashTimer: 0, dashCooldown: 0, hurtTimer: 0, attack: null, attackIndex: 0,
      attackKind: '', attackProgress: 0, chainTimer: 0, lastLightIndex: -1, queuedAttack: null,
      lastSafeX: 125, lastSafeY: 450, flash: 0,
      shield: false, defending: false, blockTimer: 0, mana: { fist: 0, storm: 0, legion: 0 },
      weapon: null, weaponTimer: 0, crownCallout: 0,
    };
    this.checkpoint = { x: 125, stage: 1, cleared: [], score: 0, kills: 0, time: 0, maxCombo: 0 };
    this._winTimer = 0;
    this._tutorialStep = 0;
  }

  start() { this._reset(); this._emit('start'); return this; }
  restart() { return this.start(); }
  retryCheckpoint() { return this.respawn(); }
  pause() { if (this.state === 'playing') { this.state = 'paused'; this._emit('pause'); } }
  resume() { if (this.state === 'paused') { this.state = 'playing'; this._emit('resume'); } }

  exportSave() {
    return { version: 1, seed: this.seed, checkpoint: { ...this.checkpoint, cleared: [...this.checkpoint.cleared] } };
  }

  importSave(data) {
    const saved = data?.checkpoint;
    if (data?.version !== 1 || !saved || !Array.isArray(saved.cleared)) return false;
    const numeric = ['x', 'stage', 'score', 'kills', 'time', 'maxCombo'];
    if (numeric.some(key => !Number.isFinite(saved[key]) || saved[key] < 0)) return false;
    if (saved.stage < 1 || saved.stage > 5 || !Number.isInteger(saved.stage)) return false;
    if (saved.x < 19 || saved.x > 6800 || saved.cleared.length > 7) return false;
    if (saved.cleared.some((id, index) => id !== index)) return false;
    const nextArena = ARENAS[saved.cleared.length];
    if (saved.x > nextArena.left + 90) return false;
    this.checkpoint = { x: saved.x, stage: saved.stage, score: saved.score, kills: saved.kills, time: saved.time, maxCombo: saved.maxCombo, shield: saved.shield === true || (saved.shield === undefined && saved.cleared.length > 0), cleared: [...saved.cleared] };

    this.checkpoint.mana=Object.fromEntries(['fist','storm','legion'].map(k=>[k,clamp(Number(saved.mana?.[k])||0,0,100)]));

    if (Number.isInteger(data.seed)) this.seed = data.seed >>> 0;
    this.respawn();
    return true;
  }

  /** Optional checkpoint continue; restart() always begins a clean run. */
  respawn() {
    const saved = { ...this.checkpoint, cleared: [...this.checkpoint.cleared] };
    this._reset();
    this.checkpoint = saved;
    this.player.x = saved.x;
    this.player.lastSafeX = saved.x;
    this.player.rage = 35;
    this.player.shield = saved.shield === true;

    this.player.mana={fist:0,storm:0,legion:0,...saved.mana};
    this.player.invulnerable = 1.5;
    this.score = saved.score;
    this.kills = saved.kills;
    this.time = saved.time;
    this.maxCombo = saved.maxCombo;
    this.stage = saved.stage;
    this.stageName = STAGES[this.stage - 1];
    for (const a of this.arenas) a.cleared = saved.cleared.includes(a.id);
    this.pickups = this.pickups.filter(p => p.x > saved.x - 80);
    if (saved.kills >= 2 && !this.player.shield) this.pickups.push({ id: ++this._id, x: saved.x + 55, y: 418, type: 'shield', phase: 0 });
    this.camera = clamp(saved.x - 340, 0, this.levelWidth - 960);
    this.message = 'ONE MORE TRY. THE CROWN IS WAITING.';
    this.messageTimer = 3;
    this._emit('checkpoint', { restored: true });
    return this;
  }

  random() {
    this._rng = (Math.imul(this._rng, 1664525) + 1013904223) >>> 0;
    return this._rng / 4294967296;
  }

  _emit(type, data = {}) { this.onEvent({ type, ...data }); }
  _setState(actor, state) { if (actor.state !== state) { actor.state = state; actor.animTime = 0; } }

  update(dt, input = {}) {
    if (!Number.isFinite(dt) || dt <= 0 || this.state === 'paused' || this.state === 'menu') return;
    let remaining = Math.min(dt, .1);
    let actions = input;
    while (remaining > .000001) {
      const step = Math.min(remaining, 1 / 120);
      this._step(step, actions);
      remaining -= step;
      actions = { left: input.left, right: input.right, up: input.up, down: input.down, defend: input.defend };
    }
  }

  _step(dt, input) {
    this.shake = Math.max(0, this.shake - dt * 28);
    this.flash = Math.max(0, this.flash - dt * 2.8);
    this._updateParticles(dt);
    // Terminal gameplay still plays the death sequence, then holds its final pose.
    if (this.state === 'dead') this.player.animTime = Math.min(1.2, this.player.animTime + dt);
    if (this.state !== 'playing') return;
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      // Preserve taps during impact freeze instead of dropping player input.
      if (input.jump) this.player.jumpBuffer = .15;
      if (input.attack || input.heavy || input.special) this.player.queuedAttack = input.special ? 'special' : input.heavy ? 'heavy' : 'light';
      if (input.dash) this.player.dashBuffered = .12;
      const magic=input.magicFist?'fist':input.magicStorm?'storm':input.magicLegion?'legion':null;
      if(magic&&this.player.mana[magic]>=100&&!this.magicEffect){this.player.queuedMagic=magic;this.player.queuedMagicTimer=1;}
      return;
    }
    this.time += dt;
    this._updateMagic(dt);
    this.messageTimer = Math.max(0, this.messageTimer - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer === 0) this.combo = 0;
    this._updatePlayer(dt, input);
    if (this.state !== 'playing') return;
    for (const enemy of this.enemies) {
      this._updateEnemy(enemy, dt);
      if (this.state !== 'playing') return;
    }
    this._updateProjectiles(dt);
    if (this.state !== 'playing') return;
    this._collectPickups(dt);
    this._updateProgress(dt);
    const cameraTarget = clamp(this.player.x - 340 + this.player.facing * 35, 0, this.levelWidth - 960);
    this.camera += (cameraTarget - this.camera) * Math.min(1, dt * 7);
    this.enemies = this.enemies.filter(e => !e.dead || e.deathTimer > 0 || e === this.boss);
  }

  _updatePlayer(dt, input) {
    const p = this.player;
    p.animTime += dt;
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    p.blockTimer = Math.max(0, (p.blockTimer || 0) - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.chainTimer = Math.max(0, p.chainTimer - dt);
    p.dashBuffered = Math.max(0, (p.dashBuffered || 0) - dt);
    if (p.chainTimer === 0 && !p.attack) p.lastLightIndex = -1;
    p.jumpBuffer = input.jump ? .15 : Math.max(0, p.jumpBuffer - dt);
    p.coyote = p.grounded ? .11 : Math.max(0, p.coyote - dt);
    if (p.drink) {
      p.drink.elapsed += dt;
      p.drink.progress = clamp(p.drink.elapsed / p.drink.duration, 0, 1);
      p.vx = 0;
      this._physics(p, dt);
      if (p.drink.progress >= 1) this._finishDrink();
      return;
    }
    p.aimDirection = input.up ? 'up' : input.down ? 'down' : 'forward';
    if(p.castTimer>0){p.castTimer=Math.max(0,p.castTimer-dt);p.attackProgress=1-p.castTimer/.65;p.vx=0;this._physics(p,dt);this._setState(p,'special');return;}
    p.queuedMagicTimer=Math.max(0,(p.queuedMagicTimer||0)-dt);
    if(p.queuedMagicTimer===0)p.queuedMagic=null;
    const direction = Number(!!input.right) - Number(!!input.left);
    if (direction && p.dashTimer <= 0 && !p.attack && p.hurtTimer <= 0) p.facing = direction;

    p.weaponTimer = Math.max(0, (p.weaponTimer || 0) - dt);
    if (p.weaponTimer === 0) p.weapon = null;
    p.defending = !!input.defend && p.shield && !p.attack && p.hurtTimer <= 0 && p.dashTimer <= 0;
    if (p.defending) { p.vx *= Math.pow(.02, dt); this._setState(p, 'defend'); }
    if (input.magicFist) this._castMagic('fist');
    if (input.magicStorm) this._castMagic('storm');
    if (input.magicLegion) this._castMagic('legion');
    if(p.castTimer>0){this._setState(p,'special');p.vx=0;return;}

    if ((input.dash || p.dashBuffered > 0) && p.dashCooldown <= 0 && p.hurtTimer <= 0) {
      p.dashTimer = .19;
      p.dashCooldown = .60;
      p.dashBuffered = 0;
      p.invulnerable = Math.max(p.invulnerable, .27);
      p.attack = null;
      p.defending = false;
      p.attackTimer = 0;
      p.queuedAttack = null;
      if (direction) p.facing = direction;
      p.vy = Math.min(p.vy, 0);
      this._setState(p, 'dash');
      this._emit('dash', { x: p.x, y: p.y });
      this._burst(p.x, p.y - 22, '#84ebe0', 12, 90);
    }

    if (p.jumpBuffer > 0 && p.hurtTimer <= 0 && p.dashTimer <= 0) {
      const firstJump = p.grounded || p.coyote > 0;
      if (firstJump || p.jumpsUsed < 2) {
        p.vy = firstJump ? -650 : -585;
        p.jumpsUsed = firstJump ? 1 : 2;
        p.grounded = false;
        p.coyote = 0;
        p.jumpBuffer = 0;
        this._emit('jump', { double: !firstJump });
        this._burst(p.x, p.y, '#eae1c3', firstJump ? 5 : 10, 100);
      }
    }

    const requested = input.special ? 'special' : input.heavy ? 'heavy' : input.attack ? 'light' : null;
    if (requested) {
      if (!p.attack && p.hurtTimer <= 0 && p.dashTimer <= 0) this._startAttack(requested);
      else if (p.attack && p.attack.duration - p.attack.elapsed < .25) p.queuedAttack = requested;
    }

    if (p.dashTimer > 0) {
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      p.vx = p.facing * 900;
      p.vy *= .91;
      if (Math.floor(p.animTime * 45) !== Math.floor((p.animTime - dt) * 45)) this._burst(p.x - p.facing * 15, p.y - 35, '#6ae5df', 2, 45);
    } else if (p.hurtTimer > 0) {
      p.vx *= Math.pow(.025, dt);
      this._setState(p, 'hurt');
    } else {
      const desired = direction * 325 * (p.attack ? .30 : p.defending ? .15 : 1);
      p.vx += (desired - p.vx) * Math.min(1, dt * (p.grounded ? 24 : 12));
    }

    if (p.attack) {
      const attack = p.attack;
      attack.elapsed += dt;
      p.attackTimer = Math.max(0, attack.duration - attack.elapsed);
      p.attackProgress = clamp(attack.elapsed / attack.duration, 0, 1);
      if (attack.elapsed >= attack.start && attack.elapsed <= attack.end) this._playerHitbox(attack);
      if (attack.elapsed >= attack.duration) {
        p.attack = null;
        p.attackTimer = 0;
        p.chainTimer = .42;
        if(p.queuedMagic){const magic=p.queuedMagic;p.queuedMagic=null;p.queuedAttack=null;this._castMagic(magic);}
        else if (p.queuedAttack) {
          const queued = p.queuedAttack;
          p.queuedAttack = null;
          this._startAttack(queued);
        }
      }
    } else if (p.queuedAttack && p.hurtTimer <= 0 && p.dashTimer <= 0) {
      const queued = p.queuedAttack;
      p.queuedAttack = null;
      this._startAttack(queued);
    }

    if(!p.attack&&p.queuedMagic&&p.hurtTimer<=0){const kind=p.queuedMagic;p.queuedMagic=null;this._castMagic(kind);}
    this._physics(p, dt, !!input.down);
    const bounds = this.arena ? [this.arena.left + p.w / 2, this.arena.right - p.w / 2] : [p.w / 2, this.levelWidth - p.w / 2];
    const lockedGate = this.arenas.find(a => !a.cleared);
    if (lockedGate && !this.arena) bounds[1] = Math.min(bounds[1], lockedGate.right - p.w / 2);
    p.x = clamp(p.x, bounds[0], bounds[1]);
    if (p.grounded && p.y === WORLD.floor) {
      const safe = this.platforms.find(platform => platform.type === 'ground' && p.x > platform.x + 35 && p.x < platform.x + platform.w - 35);
      if (safe) { p.lastSafeX = p.x; p.lastSafeY = p.y; }
    }
    if (p.y > 700) {
      p.invulnerable = 0;
      this._damagePlayer(24, p.x, 'pit');
      p.x = p.lastSafeX;
      p.y = p.lastSafeY;
      p.vx = 0;
      p.vy = 0;
      p.grounded = true;
      p.jumpsUsed = 0;
      p.invulnerable = 1.5;
      this.message = 'THE ABYSS DOES NOT ACCEPT RETURNS.';
      this.messageTimer = 2.5;
    }
    if (p.dead) return;
    if(p.castTimer>0)this._setState(p,'special');
    else if (p.dashTimer > 0) this._setState(p, 'dash');
    else if (p.hurtTimer > 0) this._setState(p, 'hurt');
    else if (p.defending) this._setState(p, 'defend');
    else if (p.attack) this._setState(p, p.attack.kind === 'light' ? 'attack' : p.attack.kind);
    else if (!p.grounded) this._setState(p, p.vy < 0 ? 'jump' : 'fall');
    else this._setState(p, Math.abs(p.vx) > 25 ? 'run' : 'idle');
  }

  _physics(actor, dt, drop = false) {
    const oldY = actor.y;
    const wasGrounded = actor.grounded;
    actor.x += actor.vx * dt;
    if (!(actor.type === 'hero' && actor.dashTimer > 0)) actor.vy = Math.min(actor.vy + WORLD.gravity * dt, 1100);
    actor.y += actor.vy * dt;
    actor.grounded = false;
    if (actor.vy >= 0) {
      let floor = Infinity;
      for (const platform of this.platforms) {
        if (drop && platform.type !== 'ground' && oldY >= platform.y - 2) continue;
        if (actor.x + actor.w * .36 > platform.x && actor.x - actor.w * .36 < platform.x + platform.w && oldY <= platform.y + 2 && actor.y >= platform.y) floor = Math.min(floor, platform.y);
      }
      if (floor < Infinity) {
        actor.y = floor;
        actor.vy = 0;
        actor.grounded = true;
        if (actor.type === 'hero') {
          actor.jumpsUsed = 0;
          if (!wasGrounded) { this._emit('land'); this._burst(actor.x, actor.y, '#c4aeb1', 5, 90); }
        }
      }
    }
  }

  _finishDrink() {
    const p = this.player, kind = p.drink.kind;
    p.drink = null;
    this._setState(p, 'idle');
    if (kind === 'green_potion') {
      const amount = Math.min(42, p.maxHp - p.hp); p.hp += amount;
      this._floating(p.x, p.y - 100, `+${amount} HEALTH`, '#a0f5a5');
    } else if (kind === 'red_potion') {
      p.invulnerable = 0; this._damagePlayer(28, p.x, 'poison');
      this._floating(p.x, p.y - 100, 'POISON!', '#ff7a6b');
    } else {
      this._gainMana(25); p.rage=Math.min(100,p.rage+15);
      this._floating(p.x, p.y - 100, 'MAGIC RESTORED!', '#fff09b');

    }
  }

  _gainMana(amount) {
    for (const kind of ['fist', 'storm', 'legion']) this.player.mana[kind] = Math.min(100, this.player.mana[kind] + amount);
  }

  _castMagic(kind) {
    const p=this.player;
    if ((p.mana?.[kind]||0)<100 || p.dead || p.drink || this.magicEffect) { this._emit('magicDenied',{kind}); return; }
    if(p.attack||p.hurtTimer>0){p.queuedMagic=kind;p.queuedMagicTimer=1;return;}
    const visible=this.enemies.filter(e=>!e.dead&&e.x>=this.camera-e.w/2&&e.x<=this.camera+960+e.w/2);
    const enemies=visible.filter(e=>!e.intro);
    if(visible.length&&!enemies.length){this.message='WAIT FOR THE CHALLENGER!';this.messageTimer=1.2;return;}
    p.castTimer=.65;p.invulnerable=Math.max(p.invulnerable,.85);p.defending=false;p.attackProgress=0;p.animTime=0;
    p.mana[kind]=0; this.shake=kind==='legion'?12:9; this.flash=.32;
    const center=kind==='fist'&&enemies.length?enemies.reduce((sum,e)=>sum+e.x,0)/enemies.length:p.x;
    this.magicEffect = { kind, elapsed: 0, duration: 1.8, impactAt: .65, impacted: false, targetIds: enemies.map(e => e.id), targetXs: enemies.map(e => e.x), x: center };
    const label=kind==='fist'?'SKY FIST!':kind==='storm'?'JUDGMENT STORM!':'VICTORY LEGION!';
    this.message=label;this.messageTimer=2.5;this._floating(p.x,p.y-140,label,'#fff1a6');
    this._burst(p.x,p.y-70,kind==='storm'?'#a9f4ff':kind==='legion'?'#e8c6ff':'#ffdc82',45,390);this._emit('magic',{kind});
  }

  _updateMagic(dt) {
    const effect = this.magicEffect;
    if (!effect) return;
    effect.elapsed += dt;
    effect.progress = Math.min(1, effect.elapsed / effect.duration);
    if (!effect.impacted && effect.elapsed >= effect.impactAt) {
      effect.impacted = true;
      for (const enemy of this.enemies) {
        if (enemy.dead || !effect.targetIds.includes(enemy.id)) continue;
        const amount = enemy.isBoss ? Math.ceil(enemy.maxHp * (effect.kind === 'legion' ? .35 : effect.kind === 'storm' ? .20 : .15)) : effect.kind === 'fist' ? 180 : 9999;
        this._damageEnemy(enemy, amount, { kind: 'magic', knock: 360, stun: .65, index: 2 });
      }
      this.shake = 12; this.flash = .25;
      this._emit('magicImpact', { kind: effect.kind });
    }
    if (effect.elapsed >= effect.duration) this.magicEffect = null;
  }

  _startAttack(kind) {
    const p = this.player;
    if (p.dead || p.drink || p.castTimer>0) return false;
    if (kind === 'special' && p.rage < 100) {
      this._emit('specialDenied', { rage: p.rage });
      return false;
    }
    if (kind === 'light' && !p.grounded) kind = 'airattack';
    const index = kind === 'light' ? (p.chainTimer > 0 || p.lastLightIndex >= 0 ? (p.lastLightIndex + 1) % 3 : 0) : 0;
    const definition = kind === 'light' ? ATTACKS.light[index] : ATTACKS[kind];
    if (!definition) return false;
    const multiplier=p.weapon?1.28:1;
    p.attack = { ...definition, damage:Math.round(definition.damage*multiplier), range:Math.round(definition.range*(p.weapon==='tree'?1.5:1)), direction: p.aimDirection || 'forward', kind, index, elapsed: 0, hit: new Set() };
    p.attackTimer = definition.duration;
    p.attackIndex = index;
    p.attackKind = kind;
    p.attackProgress = 0;
    p.animTime = 0;
    p.defending = false;
    p.lastLightIndex = kind === 'light' ? index : -1;
    p.chainTimer = definition.duration + .4;
    this._setState(p, kind === 'light' ? 'attack' : kind);
    if (kind === 'special') {
      p.rage = 0;
      p.invulnerable = Math.max(p.invulnerable, 1.0);
      this.flash = .5;
      this.shake = 8;
      this.message = 'VAE VICTIS!';
      this.messageTimer = 1.4;
      this._burst(p.x, p.y - 35, '#ffe390', 32, 300);
    }
    this._emit(kind === 'light' || kind === 'airattack' ? 'attack' : kind, { kind, index, x: p.x, y: p.y });
    return true;
  }

  _playerHitbox(attack) {
    const p = this.player;
    const special = attack.kind === 'special';
    const box = {
      x: special ? p.x - attack.range : p.facing > 0 ? p.x - 18 : p.x - attack.range,
      y: p.y - (special ? 180 : attack.kind === 'heavy' ? 125 : 95),
      w: special ? attack.range * 2 : attack.range + 18,
      h: special ? 230 : attack.kind === 'airattack' ? 145 : 128,
    };
    if (!special && attack.direction === 'up') Object.assign(box, { x: p.x - 55, y: p.y - p.h - attack.range, w: 110, h: attack.range + p.h });
    if (!special && attack.direction === 'down') Object.assign(box, { x: p.x - 52, y: p.y - 30, w: 104, h: attack.range + 30 });
    for (const prop of this.props) {
      if (prop.broken || attack.hit.has(prop.id) || !overlap(box, body(prop))) continue;
      if (prop.type !== 'barrel') continue;
      attack.hit.add(prop.id); prop.hp = Math.max(0, prop.hp - attack.damage);
      this._burst(prop.x, prop.y - 30, '#bc8a51', 12, 170);
      if (prop.hp === 0) {
        prop.broken = true;
        this.pickups.push({ id: ++this._id, x: prop.x, y: prop.y - 24, type: 'gem', phase: 0 });
        this._emit('propBreak', { kind: prop.type, x: prop.x });
      }
    }
    for (const enemy of this.enemies) {
      if (enemy.dead || attack.hit.has(enemy.id) || !overlap(box, body(enemy))) continue;
      attack.hit.add(enemy.id);
      this._damageEnemy(enemy, attack.damage, attack);
    }
    for (const projectile of this.projectiles) {
      if (projectile.dead || !overlap(box, { x: projectile.x - projectile.w / 2, y: projectile.y - projectile.h / 2, w: projectile.w, h: projectile.h })) continue;
      projectile.dead = true;
      p.rage = Math.min(100, p.rage + 4);
      this._burst(projectile.x, projectile.y, '#a0fff0', 9, 180);
      this._emit('parry', { x: projectile.x, y: projectile.y });
    }
  }

  _damageEnemy(enemy, damage, attack) {
    if (enemy.dead || enemy.intro) return;
    const armored = (enemy.type === 'ogre' || enemy.isBoss) && enemy.state === 'telegraph' && attack.kind === 'light';
    const amount = Math.min(enemy.hp,Math.max(0,armored ? Math.round(damage * .72) : damage));
    enemy.hp = Math.max(0, enemy.hp - amount);
    enemy.flash = .15;
    const facing = enemy.x >= this.player.x ? 1 : -1;
    if (!enemy.isBoss) {
      enemy.vx = facing * attack.knock;
      if (attack.launch) { enemy.vy = -attack.launch * (enemy.type === 'ogre' ? .58 : 1); enemy.grounded = false; }
      if (!armored) {
        enemy.hurtTimer = attack.stun;
        enemy.telegraphTimer = 0;
        enemy.attackTimer = 0;
        enemy.pendingAttack = null;
        this._setState(enemy, 'hurt');
      }
    } else if (attack.kind === 'special') {
      enemy.hurtTimer = .42;
      enemy.telegraphTimer = 0;
      enemy.attackTimer = 0;
      enemy.pendingAttack = null;
      this._setState(enemy, 'hurt');
    }
    this.combo += 1;
    if (attack.kind !== 'magic') this._gainMana(3);
    this.comboTimer = 3.2;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.player.rage = clamp(this.player.rage + (attack.kind === 'special' ? 0 : 5), 0, 100);
    this.score += Math.round(amount * (1 + Math.min(this.combo, 40) / 40));
    this.hitstop = Math.max(this.hitstop, attack.kind === 'heavy' || attack.index === 2 ? .065 : .035);
    this.shake = Math.max(this.shake, attack.kind === 'special' ? 10 : attack.kind === 'heavy' ? 6 : 3);
    this._burst(enemy.x, enemy.y - enemy.h * .6, enemy.type === 'skeleton' ? '#fff1c7' : '#91ebbb', 9, 200);
    this._floating(enemy.x, enemy.y - enemy.h, String(amount), '#ffefb1');
    this._emit('hit', { target: enemy.type, damage: amount, x: enemy.x, y: enemy.y, combo: this.combo });
    if (this.combo % 10 === 0) { this._emit('combo', { combo: this.combo }); this._floating(this.player.x, this.player.y - 115, `${this.combo} BRUTAL!`, '#fff3ad'); }
    if (enemy.hp === 0) this._killEnemy(enemy);
  }

  _killEnemy(enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
    enemy.deathTimer = .75;
    enemy.telegraphTimer = 0;
    enemy.attackTimer = 0;
    enemy.pendingAttack = null;
    enemy.vy = -230;
    enemy.vx = this.player.facing * 180;
    this._setState(enemy, 'dead');
    this.kills += 1;
    if(this.kills===2&&!this.player.shield)this.pickups.push({id:++this._id,x:enemy.x-30,y:418,type:'shield',phase:0});
    this._gainMana(8);
    const points = Math.round(ENEMY[enemy.type].score * (1 + Math.min(this.combo, 30) * .025));
    this.score += points;
    this.player.rage = Math.min(100, this.player.rage + 7);
    this._floating(enemy.x, enemy.y - enemy.h - 25, `+${points}`, '#ffca67');
    this._burst(enemy.x, enemy.y - enemy.h / 2, '#d7dbb5', 15, 230);
    if (enemy.type !== 'boss' && (this.player.hp < 48 || this.random() < .16)) this.pickups.push({ id: ++this._id, x: enemy.x, y: 418, type: 'meat', phase: this.random() * 6 });
    this._emit('kill', { target: enemy.type, score: points });
  }

  _damagePlayer(amount, sourceX, kind = 'enemy') {
    const p = this.player;
    if (p.invulnerable > 0 || p.dead || this.state !== 'playing') return false;
    if (p.defending && p.shield && kind !== 'pit' && kind !== 'poison' && Math.sign(sourceX-p.x) === p.facing) {
      p.rage = Math.min(100, p.rage + 8);
      this._gainMana(4);
      p.blockTimer = .18;
      this.hitstop = Math.max(this.hitstop, .035);
      this.shake = Math.max(this.shake, 2);
      this._setState(p, 'defend');
      this._emit('block', { kind, x: p.x, y: p.y - 48 });
      this._burst(p.x + p.facing * 27, p.y - 48, '#fff2b2', 10, 160);
      // A consumed projectile must disappear even when the shield absorbs its damage.
      return true;
    }
    p.hp = Math.max(0, p.hp - amount);
    p.rage = Math.min(100, p.rage + 12);
    p.invulnerable = .90;
    p.flash = .25;
    p.hurtTimer = .28;
    p.vx = (p.x >= sourceX ? 1 : -1) * 275;
    p.vy = -190;
    p.grounded = false;
    p.attack = null;
    p.defending = false;
    p.attackTimer = 0;
    p.queuedAttack = null;
    p.dashTimer = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.hitstop = .075;
    this.shake = 9;
    this.flash = .18;
    this._setState(p, 'hurt');
    this._burst(p.x, p.y - 40, '#ff846b', 14, 180);
    this._floating(p.x, p.y - 95, `−${amount}`, '#ff907c');
    this._emit('hurt', { damage: amount, kind });
    if (p.hp === 0) {
      p.dead = true;
      this._setState(p, 'dead');
      this.state = 'dead';
      this._emit('death', { score: this.score, kills: this.kills, checkpoint: this.checkpoint.x });
    }
    return true;
  }

  _spawnEnemy(type, x, arenaId = this.arena?.id ?? -1, bossId = null) {
    const def = ENEMY[type];
    const enemy = {
      id: ++this._id, type, x, y: WORLD.floor, w: def.w, h: def.h, vx: 0, vy: 0,
      hp: def.hp, maxHp: def.hp, facing: x > this.player.x ? -1 : 1, state: 'idle', animTime: 0,
      attackTimer: 0, telegraphTimer: 0, telegraphDuration: 0, invulnerable: 0,
      dead: false, grounded: true, hurtTimer: 0, flash: 0, cooldown: .7 + this.random() * .8,
      attackKind: 'slash', attackCount: 0, phase: 1, arenaId, deathTimer: 0,
      speed: def.speed * (.93 + this.random() * .14), spawnTimer: .5,
      isBoss: type === 'boss' || type === 'bone_king', renderType: type, bossId, scale: 1,
    };
    if (type === 'witch') { enemy.flying = true; enemy.grounded = false; enemy.y = 265; }
    if (bossId && BOSSES[bossId]) {
      const boss = BOSSES[bossId];
      Object.assign(enemy, { name: boss.name, isBoss: true, hp: boss.hp, maxHp: boss.hp, scale: boss.scale, intro: { elapsed: 0, duration: 2.6, progress: 0 }, state: 'intro', throneX: x });
      enemy.y=WORLD.floor;
      enemy.w *= boss.scale; enemy.h *= boss.scale;
      this.boss = enemy;
    }
    this.enemies.push(enemy);
    this._burst(x, WORLD.floor - 25, '#87dbbb', 17, 150);
    if (enemy.isBoss && !bossId) { enemy.name = type === 'boss' ? 'GORGOR · KING OF HUNGER' : 'THE BONE KING'; this.boss = enemy; }
    return enemy;
  }

  _updateEnemy(enemy, dt) {
    enemy.animTime += dt;
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.spawnTimer = Math.max(0, enemy.spawnTimer - dt);
    if (enemy.dead) {
      enemy.deathTimer -= dt;
      this._physics(enemy, dt);
      return;
    }
    if (enemy.intro) {
      enemy.intro.elapsed += dt;
      enemy.intro.progress = Math.min(1, enemy.intro.elapsed / enemy.intro.duration);
      enemy.vx = 0; enemy.vy = 0;
      this._setState(enemy, 'intro');
      if (enemy.intro.progress >= 1) { enemy.intro = null; enemy.cooldown = .65; this._setState(enemy, 'idle'); }
      return;
    }
    const def = ENEMY[enemy.type];
    const p = this.player;
    const dx = p.x - enemy.x;
    const distance = Math.abs(dx);
    const feetGap = Math.abs(p.y - enemy.y);
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    enemy.hurtTimer = Math.max(0, enemy.hurtTimer - dt);

    if (enemy.isBoss && enemy.phase === 1 && enemy.hp <= enemy.maxHp * .5) {
      enemy.phase = 2;
      enemy.hurtTimer = .7;
      enemy.telegraphTimer = 0;
      enemy.attackTimer = 0;
      enemy.pendingAttack = null;
      enemy.cooldown = .9;
      this.shake = 12;
      this.flash = .34;
      this.message = `${enemy.name}: YOU WILL KNEEL!`;
      this.messageTimer = 3.5;
      this._burst(enemy.x, enemy.y - 75, '#ff9b51', 35, 310);
      this._emit('boss', { phase: 2 });
    }
    if (enemy.hurtTimer > 0 || enemy.spawnTimer > 0) {
      enemy.vx *= Math.pow(.015, dt);
      this._setState(enemy, enemy.hurtTimer > 0 ? 'hurt' : 'idle');
    } else if (enemy.telegraphTimer > 0) {
      enemy.telegraphTimer -= dt;
      enemy.vx = 0;
      this._setState(enemy, 'telegraph');
      if (enemy.telegraphTimer <= 0) this._resolveEnemyAttack(enemy);
    } else if (enemy.attackTimer > 0) {
      enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);
      if (enemy.pendingAttack) {
        enemy.pendingAttack.elapsed += dt;
        if (enemy.pendingAttack.elapsed >= enemy.pendingAttack.contactAt) {
          enemy.pendingAttack = null;
          this._performEnemyAttack(enemy);
        }
      }
      if (enemy.attackKind === 'rush' && !enemy.pendingAttack && enemy.attackTimer > .12) {
        enemy.vx = enemy.facing * 650;
        if (!enemy.rushHit && overlap(body(enemy), body(p))) enemy.rushHit = this._damagePlayer(def.damage + 3, enemy.x);
      } else enemy.vx *= Math.pow(.001, dt);
      this._setState(enemy, enemy.attackTimer > .30 ? 'attack' : 'recover');
    } else {
      enemy.facing = dx >= 0 ? 1 : -1;
      const windupCount = this.enemies.filter(e => !e.dead && e.telegraphTimer > 0).length;
      const canMelee = distance < def.reach + 16 && feetGap < 115;
      const canRanged = ['skeleton','boss','witch','ghost','demon','vampire'].includes(enemy.type) && (distance > 180 || enemy.flying) && distance < 590;
      const isBoss = enemy.isBoss;
      if (enemy.cooldown <= 0 && (enemy.grounded || enemy.flying) && (canMelee || canRanged) && (windupCount < 2 || isBoss)) {
        enemy.attackCount += 1;
        enemy.attackKind = canRanged ? 'bolt' : enemy.type === 'ogre' || enemy.type === 'raven_orc' || enemy.type === 'bone_king' ? 'smash' : 'slash';
        if (enemy.type === 'raven_orc' && enemy.attackCount % 3 === 0) enemy.attackKind='ravens';
        if (enemy.type === 'bone_king' && enemy.attackCount % 3 === 0) enemy.attackKind='hands';
        if (isBoss && !['hands', 'ravens'].includes(enemy.attackKind) && !enemy.flying) {
          if (enemy.phase === 2 && enemy.attackCount % 3 === 0) enemy.attackKind = 'rush';
          else if (enemy.attackCount % 3 === 0 || (enemy.phase === 2 && enemy.attackCount % 2 === 0)) enemy.attackKind = 'smash';
        }
        enemy.telegraphDuration = def.windup * (isBoss && enemy.phase === 2 ? .82 : 1);
        if (enemy.attackKind === 'smash') enemy.telegraphDuration += .22;
        enemy.telegraphTimer = enemy.telegraphDuration;
        enemy.targetX = p.x;
        enemy.rushHit = false;
        enemy.vx = 0;
        this._setState(enemy, 'telegraph');
        this._emit('telegraph', { target: enemy.type, kind: enemy.attackKind, x: enemy.x });
      } else {
      const chase = distance > def.reach * .74;
        enemy.vx = chase ? enemy.facing * enemy.speed * (isBoss && enemy.phase === 2 ? 1.28 : 1) : 0;
        // Ground fighters leap onto reachable ledges, so the player cannot camp forever.
        if (enemy.grounded && p.y < enemy.y - 60 && distance < 230 && enemy.cooldown < .55) {
          enemy.vy = -610;
          enemy.grounded = false;
          enemy.vx = enemy.facing * enemy.speed * 1.9;
          enemy.cooldown = .75;
        }
        this._setState(enemy, Math.abs(enemy.vx) > 5 ? 'run' : 'idle');
        // Gentle separation keeps groups readable without blocking attacks.
        for (const other of this.enemies) {
          if (other === enemy || other.dead || Math.abs(other.y - enemy.y) > 35) continue;
          const gap = enemy.x - other.x;
          if (Math.abs(gap) < (enemy.w + other.w) * .37) enemy.vx += Math.sign(gap || enemy.id - other.id) * 32;
        }
      }
    }
    if (enemy.flying) {
      enemy.x += enemy.vx * dt;
      enemy.y += (265 + Math.sin(this.time * 2 + enemy.id) * 18 - enemy.y) * Math.min(1, dt * 4);
      enemy.vy = 0; enemy.grounded = false;
    } else this._physics(enemy, dt);
    const arena = this.arenas[enemy.arenaId];
    if (arena) enemy.x = clamp(enemy.x, arena.left + enemy.w / 2 + 8, arena.right - enemy.w / 2 - 8);
    if (enemy.y > 700) { enemy.y = WORLD.floor; enemy.vy = 0; enemy.grounded = true; }
  }

  _resolveEnemyAttack(enemy) {
    const def = ENEMY[enemy.type];
    const isBoss = enemy.isBoss;
    enemy.telegraphTimer = 0;
    enemy.attackTimer = enemy.attackKind === 'rush' ? .80 : .58;
    enemy.cooldown = def.cooldown * (isBoss && enemy.phase === 2 ? .71 : 1);
    enemy.pendingAttack = { elapsed: 0, contactAt: .20 };
    this._setState(enemy, 'attack');
  }

  _performEnemyAttack(enemy) {
    if (enemy.dead || enemy.hurtTimer > 0) return;
    const def = ENEMY[enemy.type];
    const isBoss = enemy.isBoss;
    if (enemy.attackKind === 'ravens') {
      for(let i=0;i<4;i++)this.projectiles.push({id:++this._id,x:enemy.x,y:enemy.y-enemy.h+24,vx:(this.player.x-enemy.x)*(.48+i*.06),vy:-70+i*38,w:22,h:14,type:'raven',damage:12,life:2.5,dead:false});
      this.message='THE ORC CALLS THE RAVENS!';this.messageTimer=1.8;
    } else if (enemy.attackKind === 'hands') {
      for (const offset of [-90,0,90]) this.projectiles.push({id:++this._id,x:this.player.x+offset,y:WORLD.floor-12,vx:0,vy:0,w:46,h:65,type:'bone_hand',damage:18,life:1.2,delay:.45,dead:false});
      this.message='BONE HANDS RISE!';this.messageTimer=1.8;
    } else if (enemy.attackKind === 'bolt') {
      const shots = isBoss && enemy.phase === 2 ? [-.14, 0, .14] : [0];
      for (const angle of shots) {
        const originY = enemy.y - (isBoss ? 67 : 43);
        const targetY = this.player.y - 35;
        const dx = this.player.x - enemy.x;
        const dy = targetY - originY;
        const direction = Math.atan2(dy, dx) + angle;
        const speed = isBoss ? 310 : enemy.type==='witch'?230:280;
        const spell=enemy.type==='witch'?'poison_orb':enemy.type==='ghost'?'wail':enemy.type==='demon'||enemy.type==='vampire'?'dive':isBoss?'fireball':'bone';
        this.projectiles.push({ id: ++this._id, x: enemy.x + enemy.facing * 34, y: originY, vx: Math.cos(direction) * speed, vy: Math.sin(direction) * speed, w: isBoss ? 28 : 20, h: isBoss ? 28 : 20, type: spell, damage: isBoss ? 15 : enemy.type==='witch'?15:10, life: 3.5, dead: false });
      }
    } else if (enemy.attackKind === 'smash') {
      this.shake = Math.max(this.shake, isBoss ? 11 : 5);
      this._burst(enemy.x + enemy.facing * 45, WORLD.floor - 8, '#ffd49a', 20, 240);
      const radius = isBoss ? 197 : 132;
      if (Math.abs(this.player.x - enemy.x) < radius && Math.abs(this.player.y - enemy.y) < 80) this._damagePlayer(def.damage, enemy.x);
      if (isBoss) {
        for (const direction of [-1, 1]) this.projectiles.push({ id: ++this._id, x: enemy.x + direction * 55, y: WORLD.floor - 20, vx: direction * (enemy.phase === 2 ? 360 : 275), vy: 0, w: 38, h: 39, type: 'shockwave', damage: 16, life: 2.5, dead: false });
      }
    } else if (enemy.attackKind !== 'rush') {
      const hitbox = { x: enemy.facing > 0 ? enemy.x - 16 : enemy.x - def.reach, y: enemy.y - enemy.h + 6, w: def.reach + 16, h: enemy.h + 12 };
      if (overlap(hitbox, body(this.player))) this._damagePlayer(def.damage, enemy.x);
    }
    this._emit('enemyAttack', { target: enemy.type, kind: enemy.attackKind });
  }

  _updateProjectiles(dt) {
    for (const projectile of this.projectiles) {
      projectile.delay=Math.max(0,(projectile.delay||0)-dt);
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= dt;
      projectile.rotation = (projectile.rotation || 0) + dt * 8;
      if (!projectile.dead && projectile.delay<=0 && overlap(body(this.player), { x: projectile.x - projectile.w / 2, y: projectile.y - projectile.h / 2, w: projectile.w, h: projectile.h })) {
        if (this._damagePlayer(projectile.damage, projectile.x, projectile.type)) projectile.dead = true;
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead && p.life > 0 && p.x > -100 && p.x < this.levelWidth + 100 && p.y < 650 && p.y > -200);
  }

  _collectPickups(dt) {
    for (const item of this.pickups) {
      item.phase += dt * 3;
      if (Math.abs(item.x - this.player.x) > 37 || item.y < this.player.y - this.player.h - 8 || item.y > this.player.y + 12) continue;
      if (this.player.drink || this.player.dead) continue;
      if (['tree', 'pipe', 'barrel'].includes(item.type)) continue;
      if (item.type.endsWith('_potion') && (this.player.attack || this.player.hurtTimer > 0 || !this.player.grounded)) continue;
      item.collected = true;
      if (item.type === 'meat') {
        const amount = Math.min(25, this.player.maxHp - this.player.hp);
        this.player.hp += amount;
        this.score += 50;
        this._floating(item.x, item.y - 25, amount ? `+${amount} HEALTH` : '+50', '#a0f5a5');
      } else if (item.type === 'rage') {
        this.player.rage = Math.min(100, this.player.rage + 25);
        this._floating(item.x, item.y - 25, '+25 RAGE', '#77fff0');
      } else if (item.type === 'shield') {
        this.player.shield=true; this.message='V SHIELD ACQUIRED.';this.messageTimer=2.6;this._floating(item.x,item.y-25,'SHIELD!', '#d9eced');
        this.checkpoint.shield = true;
        this._emit('checkpoint', { x: this.checkpoint.x, acquiredShield: true });
      } else if (item.type.endsWith('_potion')) {
        this.player.drink = { kind: item.type, elapsed: 0, duration: .65, progress: 0 };
        this.player.defending = false; this.player.invulnerable = .7;
        this._setState(this.player, 'drink');
      } else if (item.type?.startsWith('mana_')) {
        const mana=item.type.slice(5);this.player.mana[mana]=100;this._floating(item.x,item.y-25,`${mana.toUpperCase()} MAGIC READY`,'#b9edff');
      } else if (item.type === 'gem') {
        this.score += 250; this._gainMana(10);
        this._floating(item.x,item.y-25,'+250 / +10 MANA','#74D4DB');
      } else if (item.type === 'club') {
        this.player.weapon=item.type;this.player.weaponTimer=18;this._floating(item.x,item.y-25,`${item.type.toUpperCase()} EQUIPPED`,'#ffda8c');
      } else { this.score += 250; this._floating(item.x, item.y - 25, '+250', '#ffe291'); }
      this._burst(item.x, item.y, '#ffe28d', 12, 140);
      this._emit('pickup', { kind: item.type });
    }
    this.pickups = this.pickups.filter(item => !item.collected);
  }

  _updateProgress(dt) {
    if (this.state !== 'playing') return;
    const nextStage = this.player.x >= 6100 ? 5 : this.player.x >= 4250 ? 4 : this.player.x >= 3200 ? 3 : this.player.x >= 2100 ? 2 : 1;
    if (nextStage > this.stage) {
      this.stage = nextStage;
      this.stageName = STAGES[nextStage - 1];
      this.message = this.stageName;
      this.messageTimer = 3.5;
      this._saveCheckpoint(this.player.x);
      this._emit('stage', { stage: this.stage, name: this.stageName });
    }
    if (!this.arena) {
      const next = this.arenas.find(a => !a.cleared);
      if (next && this.player.x >= next.left + 90) {
        this.arena = next;
        next.started = true;
        next.wave = 0;
        next.nextWave = .75;
        this.gates[next.id].active = true;
        this.message = next.name.toUpperCase();
        this.messageTimer = 3.2;
        this._emit('arenaStart', { id: next.id, name: next.name, boss: !!next.boss });
        if (next.boss) {
          this.player.hp = Math.max(this.player.hp, 75);
          this.player.rage = Math.max(this.player.rage, 60);
          this.flash=.55; this.shake=7;
          this.message = `${next.name} · CHALLENGER APPROACHES.`;
          this.messageTimer = 2.8;
          this._emit('boss', { phase: 1 });
        }
      }
    }
    if (!this.arena) return;
    const arena = this.arena;
    const alive = this.enemies.some(e => !e.dead && e.arenaId === arena.id);
    if (alive) return;
    if (arena.nextWave <= 0) arena.nextWave = arena.wave >= arena.waves.length ? .9 : 1.05;
    arena.nextWave -= dt;
    if (arena.nextWave > 0) return;
    if (arena.wave < arena.waves.length) {
      const wave = arena.waves[arena.wave];
      wave.forEach((type, index) => {
        const left = index % 2 === 1;
        let x = left ? arena.left + 72 + Math.floor(index / 2) * 85 : arena.right - 75 - Math.floor(index / 2) * 85;
        if (Math.abs(x - this.player.x) < 125) x = this.player.x < (arena.left + arena.right) / 2 ? arena.right - 65 - index * 40 : arena.left + 65 + index * 40;
        this._spawnEnemy(type, x, arena.id, arena.wave === arena.waves.length - 1 ? arena.bossId : null);
      });
      arena.wave += 1;
      arena.nextWave = 0;
      if (arena.wave > 1) { this.message = `REINFORCEMENTS · ${arena.wave}/${arena.waves.length}`; this.messageTimer = 1.8; }
    } else {
      arena.cleared = true;
      this.gates[arena.id].active = false;
      this.arena = null;
      this.score += 500;
      this._emit('arenaClear', { id: arena.id, score: 500 });
      this.projectiles = [];
      if (arena.id === this.arenas.length - 1) {
        this.state = 'won';
        this.score += Math.max(0, 6000 - Math.floor(this.time * 8));
        this.message = 'THE CROWN IS YOURS. VAE VICTIS!';
        this.messageTimer = 999;
        this._emit('win', { score: this.score, time: this.time, maxCombo: this.maxCombo, kills: this.kills });
      } else {
        if (arena.boss) this.boss = null;
        this.message = ['ALL CLEAN! THE FLOOR WOULD DISAGREE.', 'BROKEN BONES. UNBROKEN EGO.', 'ANOTHER WIN FOR THE BARBARIAN DIET.'][arena.id % 3];
        this.messageTimer = 3.0;
        this.pickups.push({ id: ++this._id, x: Math.min(this.player.x + 65, arena.right - 40), y: 415, type: 'meat', phase: 0 });
        this._saveCheckpoint(arena.right + 35);
      }
    }
  }

  _saveCheckpoint(x) {
    this.checkpoint = { x, stage: this.stage, cleared: this.arenas.filter(a => a.cleared).map(a => a.id), score: this.score, kills: this.kills, time: this.time, maxCombo: this.maxCombo, shield: this.player.shield };
    this.checkpoint.mana={...this.player.mana};
    this._emit('checkpoint', { x, stage: this.stage });
  }

  _burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = this.random() * Math.PI * 2;
      const velocity = speed * (.3 + this.random() * .7);
      const life = .20 + this.random() * .30;
      this.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity - 65, life, maxLife: life, color, size: 2 + this.random() * 4 });
    }
    if (this.particles.length > 250) this.particles.splice(0, this.particles.length - 250);
  }

  _floating(x, y, text, color) {
    this.particles.push({ x, y, vx: 0, vy: -42, life: .85, maxLife: .85, color, size: 16, text });
  }

  _updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (!p.text) p.vy += 450 * dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  snapshot() {
    return {
      state: this.state, time: this.time, score: this.score, kills: this.kills, combo: this.combo,
      maxCombo: this.maxCombo, comboTimer: this.comboTimer, stage: this.stage, stageName: this.stageName,
      player: { x: this.player.x, y: this.player.y, hp: this.player.hp, maxHp: this.player.maxHp, rage: this.player.rage, state: this.player.state, facing: this.player.facing, grounded: this.player.grounded, dashCooldown: this.player.dashCooldown },
      boss: this.boss ? { name: this.boss.name, hp: this.boss.hp, maxHp: this.boss.maxHp, phase: this.boss.phase, dead: this.boss.dead } : null,
      arena: this.arena ? { id: this.arena.id, name: this.arena.name, wave: this.arena.wave, waves: this.arena.waves.length, enemies: this.enemies.filter(e => !e.dead).length } : null,
      progress: this.arenas.filter(a => a.cleared).length / this.arenas.length,
      completedArenas: this.arenas.filter(a => a.cleared).length,
      totalArenas: this.arenas.length, checkpoint: { ...this.checkpoint, cleared: [...this.checkpoint.cleared] },
      objective: this.arena ? (this.arena.boss ? `DEFEAT ${this.boss?.name || 'THE BOSS'}` : 'DEFEAT ALL ENEMIES') : 'ADVANCE TOWARD THE CROWN',
      message: this.messageTimer > 0 ? this.message : '',
    };
  }
}
