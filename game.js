// ============================================================
// Snake Clash — v5 2-Player Local Multiplayer
// Large world, camera follow, drop shadows, sphere shading
// ============================================================

const GAME_W = 960;
const GAME_H = 960; // Square viewport for camera follow
const S = 2;
const WORLD_W = 3000;
const WORLD_H = 3000;
const SHADOW_OX = 8, SHADOW_OY = 10; // Shadow offset for 3D effect

const CHARACTER_DATA = {
    kayla:   { name: 'Kayla',   colour: 0xFF1493, type: 'Power',    superName: 'Football Kick', superDuration: 500,  evolves: 'Super Kayla' },
    kirsten: { name: 'Kirsten', colour: 0xFF4500, type: 'Fire',     superName: 'Fire Storm',    superDuration: 5000, evolves: 'Mega Kirsten' },
    kate:    { name: 'Kate',    colour: 0x9370DB, type: 'Psychic',  superName: 'Book Blast',    superDuration: 4000, evolves: 'Ultra Kate' },
    kyle:    { name: 'Kyle',    colour: 0x00BFFF, type: 'Electric', superName: 'Thunderball',   superDuration: 3000, evolves: 'Lightning Kyle' },
};

const LEVEL_CONFIGS = [
    { enemyPLRange: [5, 20],  bossMulti: 1.2, enemyCount: 10, bossSuper: false },
    { enemyPLRange: [10, 35], bossMulti: 1.4, enemyCount: 12, bossSuper: false },
    { enemyPLRange: [15, 50], bossMulti: 1.6, enemyCount: 14, bossSuper: false },
    { enemyPLRange: [20, 70], bossMulti: 1.8, enemyCount: 16, bossSuper: false },
    { enemyPLRange: [30, 90], bossMulti: 2.0, enemyCount: 18, bossSuper: true  },
];

const POWERUP_TYPES = [
    { name: 'Energy Orb',      emoji: '⚡', colour: 0xFFFF00, effect: 'pl',     value: 5 },
    { name: 'Rare Candy',      emoji: '🍖', colour: 0xFF69B4, effect: 'pl',     value: 15 },
    { name: 'Shield Berry',    emoji: '🛡',  colour: 0x00CED1, effect: 'shield', value: 3000 },
    { name: 'Speed Boost',     emoji: '💨', colour: 0x7FFF00, effect: 'speed',  value: 5000 },
    { name: 'Evolution Stone', emoji: '🌀', colour: 0xBA55D3, effect: 'pl',     value: 30 },
];

const BOSS_NAMES   = ['Rattata','Pidgeotto','Arbok','Nidoking','Dragonair','Gyarados','Alakazam','Machamp','Gengar','Tyranitar'];
const BOSS_COLOURS = [0xA0522D,0xDEB887,0x8B008B,0x9400D3,0x4169E1,0x2F4F4F,0xDAA520,0x808080,0x4B0082,0x006400];

// ============================================================
// AUDIO MANAGER
// ============================================================
class AudioManager {
    constructor() { this.ctx = null; this.masterGain = null; this.musicGain = null; this.sfxGain = null; this.musicNodes = []; this.intervals = []; this.initialized = false; }
    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain(); this.masterGain.gain.value = 0.8; this.masterGain.connect(this.ctx.destination);
            this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.3; this.musicGain.connect(this.masterGain);
            this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.5; this.sfxGain.connect(this.masterGain);
            this.initialized = true;
        } catch (e) {}
    }
    _osc(type, freq, gainVal, dest, filterFreq, filterType) {
        if (!this.ctx) return null;
        const osc = this.ctx.createOscillator(); osc.type = type; osc.frequency.value = freq;
        const gain = this.ctx.createGain(); gain.gain.value = gainVal;
        if (filterFreq) {
            const filter = this.ctx.createBiquadFilter(); filter.type = filterType || 'lowpass'; filter.frequency.value = filterFreq; filter.Q.value = 1;
            osc.connect(filter); filter.connect(gain); gain.connect(dest || this.musicGain);
            this.musicNodes.push({ osc, gain, filter }); return { osc, gain, filter };
        } else {
            osc.connect(gain); gain.connect(dest || this.musicGain);
            this.musicNodes.push({ osc, gain }); return { osc, gain };
        }
    }
    stopMusic() {
        this.musicNodes.forEach(n => { try { n.osc.stop(); } catch(e){} try { n.osc.disconnect(); } catch(e){} try { n.gain.disconnect(); } catch(e){} if (n.filter) try { n.filter.disconnect(); } catch(e){} });
        this.musicNodes = []; this.intervals.forEach(id => clearInterval(id)); this.intervals = [];
    }
    stopAll() { this.stopMusic(); }
    playArenaMusic() {
        if (!this.ctx) return; this.stopMusic();
        const pad1 = this._osc('triangle', 130.81, 0.12, null, 400); const pad2 = this._osc('triangle', 155.56, 0.10, null, 400);
        pad1.osc.start(); pad2.osc.start();
        const bass = this._osc('sine', 65.41, 0.08); bass.osc.start();
        const lfo = this.ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 1.67;
        const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 0.03;
        lfo.connect(lfoGain); lfoGain.connect(bass.gain.gain); lfo.start();
        this.musicNodes.push({ osc: lfo, gain: lfoGain });
        const hatId = setInterval(() => { if (this.ctx) this._hiHat(0.02, 50); }, 600);
        this.intervals.push(hatId); this._padFilter = pad1.filter;
    }
    transitionToCountdown() {
        if (!this.ctx || !this._padFilter) return;
        const now = this.ctx.currentTime; this._padFilter.frequency.linearRampToValueAtTime(800, now + 3);
        const tension = this._osc('sine', 98, 0.06, null, 600); tension.osc.start();
        this.intervals.forEach(id => clearInterval(id)); this.intervals = [];
        const hatId = setInterval(() => { if (this.ctx) this._hiHat(0.025, 40); }, 300);
        this.intervals.push(hatId);
        const sweep = this._osc('sawtooth', 200, 0.03, null, 800, 'bandpass');
        sweep.osc.frequency.linearRampToValueAtTime(600, now + 15); sweep.osc.start();
    }
    transitionToDuel() {
        if (!this.ctx) return; this.stopMusic(); this._padFilter = null;
        const pad1 = this._osc('sawtooth', 130.81, 0.09, null, 600); const pad2 = this._osc('sawtooth', 155.56, 0.07, null, 600);
        pad1.osc.start(); pad2.osc.start();
        const bass = this._osc('square', 65.41, 0.10, null, 200); bass.osc.start();
        const hatId = setInterval(() => { if (this.ctx) this._hiHat(0.03, 35); }, 214);
        this.intervals.push(hatId);
        const notes = [261.63, 233.08, 207.65, 196.00]; let noteIdx = 0;
        const leadId = setInterval(() => { if (!this.ctx) return; this._sfx('sawtooth', notes[noteIdx], 0.05, 0.4, this.musicGain); noteIdx = (noteIdx + 1) % 4; }, 430);
        this.intervals.push(leadId);
    }
    _hiHat(vol, dur) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = 8000;
        const filter = this.ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 6000;
        const gain = this.ctx.createGain(); gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + dur / 1000);
        osc.connect(filter); filter.connect(gain); gain.connect(this.musicGain);
        osc.start(); osc.stop(this.ctx.currentTime + dur / 1000 + 0.01);
        osc.onended = () => { try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch(e){} };
    }
    _sfx(type, freq, vol, dur, dest, freqEnd) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator(); osc.type = type; osc.frequency.value = freq;
        if (freqEnd) osc.frequency.linearRampToValueAtTime(freqEnd, this.ctx.currentTime + dur);
        const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + dur);
        osc.connect(g); g.connect(dest || this.sfxGain); osc.start(); osc.stop(this.ctx.currentTime + dur + 0.01);
        osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch(e){} };
    }
    _sfxDelayed(type, freq, vol, dur, delay) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator(); osc.type = type; osc.frequency.value = freq;
        const g = this.ctx.createGain(); const t = this.ctx.currentTime + delay;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.linearRampToValueAtTime(0, t + dur);
        osc.connect(g); g.connect(this.sfxGain); osc.start(t); osc.stop(t + dur + 0.01);
        osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch(e){} };
    }
    sfxEat() { this._sfx('sine', 400, 0.15, 0.15, null, 800); }
    sfxDamage() { this._sfx('sine', 80, 0.25, 0.2); this._sfx('square', 200, 0.08, 0.1); }
    sfxPowerUp() { [523, 659, 784].forEach((f, i) => this._sfxDelayed('sine', f, 0.12, 0.1, i * 0.06)); }
    sfxSuperpower() {
        if (this.ctx) {
            const n = this.ctx.createOscillator(); n.type = 'square'; n.frequency.value = 4000;
            const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2000; bp.Q.value = 0.5;
            const ng = this.ctx.createGain(); ng.gain.setValueAtTime(0.08, this.ctx.currentTime); ng.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
            n.connect(bp); bp.connect(ng); ng.connect(this.sfxGain); n.start(); n.stop(this.ctx.currentTime + 0.31);
            n.onended = () => { try { n.disconnect(); bp.disconnect(); ng.disconnect(); } catch(e){} };
        }
        [261.63, 392].forEach(f => this._sfx('sawtooth', f, 0.10, 0.4));
    }
    sfxBossEntrance() { this._sfx('sine', 300, 0.15, 0.8, null, 60); }
    sfxBossDefeat() { [392, 523, 659, 784].forEach((f, i) => this._sfxDelayed('triangle', f, 0.15, 0.12, i * 0.15)); }
    sfxGameOver() { [330, 261, 220].forEach((f, i) => this._sfxDelayed('triangle', f, 0.12, 0.17, i * 0.2)); }
}
const audioMgr = new AudioManager();

// ============================================================
// SPRITE FACTORY — with sphere shading
// ============================================================
class SpriteFactory {
    constructor(scene) { this.scene = scene; }
    generateAll() {
        ['kayla','kirsten','kate','kyle'].forEach(k => {
            ['N','S','E','W'].forEach(dir => this._gen(`starter_${k}_${dir}`, 128, ctx => this[`_draw_${k}`](ctx, 128, dir)));
        });
        const types = ['fire_lizard','grass_bug','water_fish','psychic_orb','dark_ghost','rock_golem'];
        types.forEach((t, i) => {
            const hue = i * 60 + 30;
            ['N','S','E','W'].forEach(dir => {
                this._gen(`enemy_${t}_${dir}`, 96, ctx => this._drawEnemy(ctx, 96, t, hue, dir, false));
                this._gen(`enemy_${t}_boss_${dir}`, 144, ctx => this._drawEnemy(ctx, 144, t, hue, dir, true));
            });
        });
    }
    _gen(key, size, drawFn) {
        if (this.scene.textures.exists(key)) return;
        const c = document.createElement('canvas'); c.width = size; c.height = size;
        drawFn(c.getContext('2d'));
        this.scene.textures.addCanvas(key, c);
    }
    _hsl(h, s, l) { return `hsl(${h},${s}%,${l}%)`; }
    // Sphere shading overlay — makes everything look 3D
    _sphereShade(ctx, cx, cy, r) {
        const grad = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, r*0.05, cx, cy, r*1.1);
        grad.addColorStop(0, 'rgba(255,255,255,0.35)');
        grad.addColorStop(0.4, 'rgba(255,255,255,0.05)');
        grad.addColorStop(0.7, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    }
    _eyes(ctx, cx, cy, r, dir, angry) {
        let lx = cx - r*0.3, rx = cx + r*0.3, ey = cy - r*0.1, plx = 0, ply = 0;
        if (dir === 'E') { plx = r*0.08; lx += r*0.08; rx += r*0.08; }
        if (dir === 'W') { plx = -r*0.08; lx -= r*0.08; rx -= r*0.08; }
        if (dir === 'N') { ply = -r*0.08; ey -= r*0.06; }
        if (dir === 'S') { ply = r*0.08; ey += r*0.06; }
        const er = r * 0.15;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(lx, ey, er, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx, ey, er, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(lx + plx, ey + ply, er*0.55, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx + plx, ey + ply, er*0.55, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(lx + er*0.2, ey - er*0.2, er*0.22, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx + er*0.2, ey - er*0.2, er*0.22, 0, Math.PI*2); ctx.fill();
        if (angry) {
            ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(lx - er, ey - er*1.2); ctx.lineTo(lx + er*0.5, ey - er*1.6); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(rx + er, ey - er*1.2); ctx.lineTo(rx - er*0.5, ey - er*1.6); ctx.stroke();
        }
    }

    // --- Kayla: Tall girl, pink/magenta, long flowing hair, sports jersey, holding football ---
    _draw_kayla(ctx, sz, dir) {
        const cx = sz/2, cy = sz/2, r = sz*0.38;
        // Long flowing hair (behind body)
        ctx.fillStyle = '#8B0045';
        ctx.beginPath();
        ctx.moveTo(cx - r*0.5, cy - r*0.7);
        ctx.quadraticCurveTo(cx - r*0.9, cy - r*0.2, cx - r*0.7, cy + r*0.6);
        ctx.quadraticCurveTo(cx - r*0.5, cy + r*0.8, cx - r*0.3, cy + r*0.9);
        ctx.lineTo(cx + r*0.3, cy + r*0.9);
        ctx.quadraticCurveTo(cx + r*0.5, cy + r*0.8, cx + r*0.7, cy + r*0.6);
        ctx.quadraticCurveTo(cx + r*0.9, cy - r*0.2, cx + r*0.5, cy - r*0.7);
        ctx.closePath();
        ctx.fill();
        // Body (tall ellipse)
        ctx.fillStyle = '#FF1493';
        ctx.beginPath(); ctx.ellipse(cx, cy + r*0.1, r*0.7, r*0.95, 0, 0, Math.PI*2); ctx.fill();
        // Head
        ctx.beginPath(); ctx.ellipse(cx, cy - r*0.45, r*0.55, r*0.5, 0, 0, Math.PI*2); ctx.fill();
        // Sports jersey white stripe
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - r*0.65, cy - r*0.05, r*1.3, r*0.22);
        // Arms
        ctx.fillStyle = '#FF1493';
        ctx.beginPath(); ctx.arc(cx - r*0.75, cy + r*0.05, r*0.18, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + r*0.75, cy + r*0.05, r*0.18, 0, Math.PI*2); ctx.fill();
        // Football (brown oval near right hand)
        ctx.fillStyle = '#8B4513';
        ctx.beginPath(); ctx.ellipse(cx + r*0.9, cy + r*0.15, r*0.18, r*0.12, 0.3, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx + r*0.82, cy + r*0.15); ctx.lineTo(cx + r*0.98, cy + r*0.15); ctx.stroke();
        // Confident eyes
        this._eyes(ctx, cx, cy - r*0.4, r*0.5, dir, false);
        // Slight smile
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy - r*0.2, r*0.15, 0.1*Math.PI, 0.9*Math.PI); ctx.stroke();
        this._sphereShade(ctx, cx, cy, r);
    }

    // --- Kirsten: Medium girl, orange/red, flame-styled spiky hair, red dress, orange glow hands ---
    _draw_kirsten(ctx, sz, dir) {
        const cx = sz/2, cy = sz/2, r = sz*0.35;
        // Flame hair (spiky upward)
        ctx.fillStyle = '#FF6600';
        const spikes = 5;
        for (let i = 0; i < spikes; i++) {
            const sx = cx - r*0.5 + (r*1.0 / (spikes-1)) * i;
            const tipY = cy - r*1.2 - Math.random()*r*0.3;
            ctx.beginPath();
            ctx.moveTo(sx - r*0.12, cy - r*0.5);
            ctx.lineTo(sx, tipY);
            ctx.lineTo(sx + r*0.12, cy - r*0.5);
            ctx.fill();
        }
        // Inner flame highlights
        ctx.fillStyle = '#FFD700';
        for (let i = 0; i < 3; i++) {
            const sx = cx - r*0.3 + (r*0.6 / 2) * i;
            ctx.beginPath();
            ctx.moveTo(sx - r*0.06, cy - r*0.55);
            ctx.lineTo(sx, cy - r*1.0);
            ctx.lineTo(sx + r*0.06, cy - r*0.55);
            ctx.fill();
        }
        // Body
        ctx.fillStyle = '#FF4500';
        ctx.beginPath(); ctx.ellipse(cx, cy + r*0.15, r*0.8, r, 0, 0, Math.PI*2); ctx.fill();
        // Head
        ctx.beginPath(); ctx.ellipse(cx, cy - r*0.35, r*0.6, r*0.5, 0, 0, Math.PI*2); ctx.fill();
        // Red dress outline
        ctx.strokeStyle = '#CC0000'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, cy + r*0.2, r*0.75, r*0.85, 0, 0.3, Math.PI - 0.3); ctx.stroke();
        // Arms with orange glow
        ctx.fillStyle = '#FF4500';
        ctx.beginPath(); ctx.arc(cx - r*0.85, cy + r*0.1, r*0.17, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + r*0.85, cy + r*0.1, r*0.17, 0, Math.PI*2); ctx.fill();
        // Orange glow around hands
        ctx.fillStyle = 'rgba(255, 165, 0, 0.3)';
        ctx.beginPath(); ctx.arc(cx - r*0.85, cy + r*0.1, r*0.28, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + r*0.85, cy + r*0.1, r*0.28, 0, Math.PI*2); ctx.fill();
        // Belly lighter
        ctx.fillStyle = '#FFDAB9';
        ctx.beginPath(); ctx.ellipse(cx, cy + r*0.3, r*0.4, r*0.35, 0, 0, Math.PI*2); ctx.fill();
        // Determined eyes
        this._eyes(ctx, cx, cy - r*0.3, r*0.55, dir, false);
        // Determined mouth
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx - r*0.12, cy - r*0.05); ctx.lineTo(cx + r*0.12, cy - r*0.08); ctx.stroke();
        this._sphereShade(ctx, cx, cy, r);
    }

    // --- Kate: Smaller, purple/lavender, bob-cut hair, glasses, holding a book ---
    _draw_kate(ctx, sz, dir) {
        const cx = sz/2, cy = sz/2, r = sz*0.32;
        // Bob-cut hair
        ctx.fillStyle = '#6A0DAD';
        ctx.beginPath();
        ctx.arc(cx, cy - r*0.3, r*0.65, Math.PI, 0);
        ctx.lineTo(cx + r*0.6, cy + r*0.05);
        ctx.quadraticCurveTo(cx + r*0.5, cy + r*0.15, cx + r*0.45, cy + r*0.1);
        ctx.lineTo(cx - r*0.45, cy + r*0.1);
        ctx.quadraticCurveTo(cx - r*0.5, cy + r*0.15, cx - r*0.6, cy + r*0.05);
        ctx.closePath();
        ctx.fill();
        // Body
        ctx.fillStyle = '#9370DB';
        ctx.beginPath(); ctx.ellipse(cx, cy + r*0.15, r*0.75, r*0.9, 0, 0, Math.PI*2); ctx.fill();
        // Head
        ctx.beginPath(); ctx.ellipse(cx, cy - r*0.35, r*0.55, r*0.48, 0, 0, Math.PI*2); ctx.fill();
        // Lighter belly
        ctx.fillStyle = '#D8BFD8';
        ctx.beginPath(); ctx.ellipse(cx, cy + r*0.3, r*0.4, r*0.4, 0, 0, Math.PI*2); ctx.fill();
        // Glasses (two circles with bridge)
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.8;
        const glY = cy - r*0.38;
        ctx.beginPath(); ctx.arc(cx - r*0.2, glY, r*0.14, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + r*0.2, glY, r*0.14, 0, Math.PI*2); ctx.stroke();
        // Bridge
        ctx.beginPath(); ctx.moveTo(cx - r*0.06, glY); ctx.lineTo(cx + r*0.06, glY); ctx.stroke();
        // Arms
        ctx.fillStyle = '#9370DB';
        ctx.beginPath(); ctx.arc(cx - r*0.8, cy + r*0.1, r*0.15, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + r*0.8, cy + r*0.1, r*0.15, 0, Math.PI*2); ctx.fill();
        // Book (rectangle near left hand)
        ctx.fillStyle = '#4B0082';
        ctx.fillRect(cx - r*1.05, cy - r*0.05, r*0.3, r*0.4);
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - r*1.0, cy + r*0.0, r*0.2, r*0.02);
        ctx.fillRect(cx - r*1.0, cy + r*0.08, r*0.2, r*0.02);
        ctx.fillRect(cx - r*1.0, cy + r*0.16, r*0.15, r*0.02);
        // Eyes behind glasses
        this._eyes(ctx, cx, cy - r*0.33, r*0.5, dir, false);
        // Studious slight smile
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy - r*0.12, r*0.1, 0.15*Math.PI, 0.85*Math.PI); ctx.stroke();
        this._sphereShade(ctx, cx, cy, r);
    }

    // --- Kyle: Smallest, electric blue, zigzag lightning-bolt hair, energetic pose, lightning patterns ---
    _draw_kyle(ctx, sz, dir) {
        const cx = sz/2, cy = sz/2, r = sz*0.28;
        // Lightning bolt hair (zigzag shapes)
        ctx.fillStyle = '#FFD700';
        // Left bolt
        ctx.beginPath();
        ctx.moveTo(cx - r*0.3, cy - r*0.6);
        ctx.lineTo(cx - r*0.5, cy - r*1.3);
        ctx.lineTo(cx - r*0.15, cy - r*0.9);
        ctx.lineTo(cx - r*0.35, cy - r*1.5);
        ctx.lineTo(cx - r*0.05, cy - r*0.7);
        ctx.closePath();
        ctx.fill();
        // Right bolt
        ctx.beginPath();
        ctx.moveTo(cx + r*0.3, cy - r*0.6);
        ctx.lineTo(cx + r*0.5, cy - r*1.3);
        ctx.lineTo(cx + r*0.15, cy - r*0.9);
        ctx.lineTo(cx + r*0.35, cy - r*1.5);
        ctx.lineTo(cx + r*0.05, cy - r*0.7);
        ctx.closePath();
        ctx.fill();
        // Centre bolt
        ctx.beginPath();
        ctx.moveTo(cx, cy - r*0.65);
        ctx.lineTo(cx - r*0.1, cy - r*1.4);
        ctx.lineTo(cx + r*0.1, cy - r*1.0);
        ctx.lineTo(cx + r*0.05, cy - r*1.6);
        ctx.lineTo(cx + r*0.15, cy - r*0.7);
        ctx.closePath();
        ctx.fill();
        // Body (small, energetic)
        ctx.fillStyle = '#00BFFF';
        ctx.beginPath(); ctx.ellipse(cx, cy + r*0.1, r*0.75, r*0.9, 0, 0, Math.PI*2); ctx.fill();
        // Head
        ctx.beginPath(); ctx.ellipse(cx, cy - r*0.4, r*0.55, r*0.48, 0, 0, Math.PI*2); ctx.fill();
        // Lightning bolt pattern on body
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - r*0.2, cy - r*0.1);
        ctx.lineTo(cx, cy + r*0.1);
        ctx.lineTo(cx - r*0.15, cy + r*0.3);
        ctx.lineTo(cx + r*0.1, cy + r*0.55);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + r*0.25, cy - r*0.05);
        ctx.lineTo(cx + r*0.1, cy + r*0.2);
        ctx.lineTo(cx + r*0.3, cy + r*0.45);
        ctx.stroke();
        // Lighter belly
        ctx.fillStyle = '#B0E0E6';
        ctx.beginPath(); ctx.ellipse(cx, cy + r*0.2, r*0.38, r*0.35, 0, 0, Math.PI*2); ctx.fill();
        // Arms (energetic/raised)
        ctx.fillStyle = '#00BFFF';
        ctx.beginPath(); ctx.arc(cx - r*0.8, cy - r*0.05, r*0.15, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + r*0.8, cy - r*0.05, r*0.15, 0, Math.PI*2); ctx.fill();
        // Wide excited eyes (bigger)
        const eyeR = r * 0.18;
        let lx = cx - r*0.25, rx = cx + r*0.25, ey = cy - r*0.42, plxE = 0, plyE = 0;
        if (dir === 'E') { plxE = r*0.08; lx += r*0.06; rx += r*0.06; }
        if (dir === 'W') { plxE = -r*0.08; lx -= r*0.06; rx -= r*0.06; }
        if (dir === 'N') { plyE = -r*0.08; ey -= r*0.04; }
        if (dir === 'S') { plyE = r*0.08; ey += r*0.04; }
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(lx, ey, eyeR, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx, ey, eyeR, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(lx + plxE, ey + plyE, eyeR*0.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx + plxE, ey + plyE, eyeR*0.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(lx + eyeR*0.25, ey - eyeR*0.25, eyeR*0.22, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx + eyeR*0.25, ey - eyeR*0.25, eyeR*0.22, 0, Math.PI*2); ctx.fill();
        // Big excited grin
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy - r*0.2, r*0.18, 0.05*Math.PI, 0.95*Math.PI); ctx.stroke();
        this._sphereShade(ctx, cx, cy, r);
    }

    _drawEnemy(ctx, sz, type, hue, dir, isBoss) {
        const cx = sz/2, cy = sz/2, r = sz*0.38;
        const col = this._hsl(hue, 60, 50), colL = this._hsl(hue, 60, 65), colD = this._hsl(hue, 60, 35);
        switch(type) {
            case 'fire_lizard': this._drawFireLizard(ctx, cx, cy, r, col, colL, colD, dir, isBoss); break;
            case 'grass_bug': this._drawGrassBug(ctx, cx, cy, r, col, colL, colD, dir, isBoss); break;
            case 'water_fish': this._drawWaterFish(ctx, cx, cy, r, col, colL, colD, dir, isBoss); break;
            case 'psychic_orb': this._drawPsychicOrb(ctx, cx, cy, r, col, colL, colD, dir, isBoss); break;
            case 'dark_ghost': this._drawDarkGhost(ctx, cx, cy, r, col, colL, colD, dir, isBoss); break;
            case 'rock_golem': this._drawRockGolem(ctx, cx, cy, r, col, colL, colD, dir, isBoss); break;
        }
        this._sphereShade(ctx, cx, cy, r);
        if (isBoss) { ctx.strokeStyle = 'rgba(255,50,50,0.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, r*1.1, 0, Math.PI*2); ctx.stroke(); }
    }
    _drawFireLizard(ctx, cx, cy, r, col, colL, colD, dir, boss) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(cx, cy, r*0.8, r*0.9, 0, 0, Math.PI*2); ctx.fill();
        const spikes = boss ? 6 : 4; ctx.fillStyle = colD;
        for (let i = 0; i < spikes; i++) { const a = -Math.PI*0.8 + (Math.PI*0.6/(spikes-1))*i; const bx = cx + Math.cos(a)*r*0.7, by = cy + Math.sin(a)*r*0.8; ctx.beginPath(); ctx.moveTo(bx-5, by); ctx.lineTo(cx + Math.cos(a)*r*1.2, cy + Math.sin(a)*r*1.3); ctx.lineTo(bx+5, by); ctx.fill(); }
        ctx.fillStyle = '#FF6600'; ctx.beginPath(); ctx.arc(cx+r*0.8, cy+r*0.3, r*0.2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(cx+r*0.8, cy+r*0.3, r*0.1, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = colL; ctx.beginPath(); ctx.ellipse(cx, cy+r*0.15, r*0.45, r*0.4, 0, 0, Math.PI*2); ctx.fill();
        this._eyes(ctx, cx, cy-r*0.1, r*0.7, dir, boss);
    }
    _drawGrassBug(ctx, cx, cy, r, col, colL, colD, dir, boss) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(cx, cy, r, r*0.7, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = colD; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx-r*0.3, cy-r*0.6); ctx.quadraticCurveTo(cx-r*0.6, cy-r*1.3, cx-r*0.2, cy-r*1.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx+r*0.3, cy-r*0.6); ctx.quadraticCurveTo(cx+r*0.6, cy-r*1.3, cx+r*0.2, cy-r*1.2); ctx.stroke();
        ctx.fillStyle = colL;
        ctx.beginPath(); ctx.arc(cx-r*0.2, cy-r*1.2, r*0.08, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+r*0.2, cy-r*1.2, r*0.08, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(200,255,200,0.3)'; ctx.strokeStyle = colL; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(cx-r*0.7, cy-r*0.1, r*0.45, r*0.25, -0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cx+r*0.7, cy-r*0.1, r*0.45, r*0.25, 0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        this._eyes(ctx, cx, cy-r*0.1, r*0.6, dir, boss);
    }
    _drawWaterFish(ctx, cx, cy, r, col, colL, colD, dir, boss) {
        ctx.fillStyle = colD; ctx.beginPath(); ctx.moveTo(cx-r*0.7, cy); ctx.lineTo(cx-r*1.3, cy-r*0.5); ctx.lineTo(cx-r*1.3, cy+r*0.5); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(cx, cy, r, r*0.6, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = colD; ctx.beginPath(); ctx.moveTo(cx-r*0.1, cy-r*0.55); ctx.lineTo(cx+r*0.1, cy-r*1.0); ctx.lineTo(cx+r*0.3, cy-r*0.5); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx+r*0.1, cy+r*0.3); ctx.lineTo(cx+r*0.4, cy+r*0.7); ctx.lineTo(cx+r*0.4, cy+r*0.3); ctx.fill();
        ctx.fillStyle = colL; ctx.beginPath(); ctx.ellipse(cx+r*0.1, cy+r*0.1, r*0.55, r*0.3, 0, 0, Math.PI*2); ctx.fill();
        this._eyes(ctx, cx+r*0.2, cy-r*0.05, r*0.5, dir, boss);
    }
    _drawPsychicOrb(ctx, cx, cy, r, col, colL, colD, dir, boss) {
        ctx.strokeStyle = colL; ctx.lineWidth = 2; ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.arc(cx, cy, r*1.1, 0, Math.PI*2); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = col; ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = (Math.PI*2/8)*i - Math.PI/8; const px = cx + Math.cos(a)*r*0.85, py = cy + Math.sin(a)*r*0.85; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = colL; ctx.beginPath(); ctx.ellipse(cx, cy-r*0.45, r*0.12, r*0.15, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy-r*0.45, r*0.06, 0, Math.PI*2); ctx.fill();
        this._eyes(ctx, cx, cy, r*0.6, dir, boss);
    }
    _drawDarkGhost(ctx, cx, cy, r, col, colL, colD, dir, boss) {
        ctx.fillStyle = col; ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.arc(cx, cy-r*0.2, r*0.8, Math.PI, 0);
        for (let i = 0; i <= 5; i++) { ctx.lineTo(cx + r*0.8 - (r*1.6/5)*i, cy + r*0.4 + Math.sin(i*Math.PI)*r*0.2); }
        ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.moveTo(cx-r*0.3, cy+r*0.5); ctx.quadraticCurveTo(cx-r*0.5, cy+r*0.9, cx-r*0.2, cy+r*1.0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx+r*0.3, cy+r*0.5); ctx.quadraticCurveTo(cx+r*0.5, cy+r*0.9, cx+r*0.2, cy+r*1.0); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        const elx = cx - r*0.25 + (dir==='E'?5:dir==='W'?-5:0), ery = cy - r*0.2 + (dir==='N'?-3:dir==='S'?3:0);
        ctx.beginPath(); ctx.ellipse(elx, ery, r*0.13, r*0.18, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(elx+r*0.5, ery, r*0.13, r*0.18, 0, 0, Math.PI*2); ctx.fill();
        if (boss) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(elx-r*0.1, ery-r*0.22); ctx.lineTo(elx+r*0.05, ery-r*0.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(elx+r*0.6, ery-r*0.22); ctx.lineTo(elx+r*0.45, ery-r*0.3); ctx.stroke(); }
    }
    _drawRockGolem(ctx, cx, cy, r, col, colL, colD, dir, boss) {
        ctx.fillStyle = col; ctx.beginPath();
        ctx.moveTo(cx-r*0.7, cy-r*0.6); ctx.lineTo(cx+r*0.7, cy-r*0.6); ctx.lineTo(cx+r*0.85, cy-r*0.1); ctx.lineTo(cx+r*0.7, cy+r*0.7); ctx.lineTo(cx-r*0.7, cy+r*0.7); ctx.lineTo(cx-r*0.85, cy-r*0.1); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = colD; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx-r*0.2, cy-r*0.5); ctx.lineTo(cx-r*0.1, cy+r*0.1); ctx.lineTo(cx+r*0.15, cy+r*0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx+r*0.3, cy-r*0.3); ctx.lineTo(cx+r*0.2, cy+r*0.2); ctx.stroke();
        ctx.fillStyle = colD;
        ctx.beginPath(); ctx.arc(cx-r*0.95, cy+r*0.1, r*0.2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+r*0.95, cy+r*0.1, r*0.2, 0, Math.PI*2); ctx.fill();
        this._eyes(ctx, cx, cy-r*0.15, r*0.6, dir, boss);
    }
    static getDir(dx, dy) {
        const a = Math.atan2(dy, dx);
        if (a > -Math.PI*0.75 && a <= -Math.PI*0.25) return 'N';
        if (a > Math.PI*0.25 && a <= Math.PI*0.75) return 'S';
        if (a > -Math.PI*0.25 && a <= Math.PI*0.25) return 'E';
        return 'W';
    }
    static getEnemyType(hue) {
        if (hue < 60) return 'fire_lizard'; if (hue < 120) return 'grass_bug'; if (hue < 180) return 'water_fish';
        if (hue < 240) return 'psychic_orb'; if (hue < 300) return 'dark_ghost'; return 'rock_golem';
    }
}

// ============================================================
// VFX MANAGER — pooled effects, NO dynamic create/destroy
// ============================================================
class VFXManager {
    constructor(scene) { this.scene = scene; this.trailSegments = []; this.posHistory = []; this.frameCount = 0; this._rainbowTrail = false; }

    initTrailPool(starterKey, colour) {
        this._trailKey = starterKey; this._trailColour = colour;
        for (let i = 0; i < 20; i++) {
            const t = i / 20;
            const glowR = Phaser.Math.Linear(14, 3, t) * 1.5;
            const shadow = this.scene.add.ellipse(0, 0, 20, 10, 0x000000, 0.15).setDepth(2).setVisible(false);
            const body = this.scene.add.image(0, 0, `starter_${starterKey}_S`).setScale(0.1).setAlpha(0).setDepth(7).setVisible(false);
            const glow = this.scene.add.circle(0, 0, glowR, colour, 0).setDepth(6).setVisible(false);
            this.trailSegments.push({ body, glow, shadow });
        }
    }

    updateTrail(x, y, colour, starterKey, dir) {
        this.frameCount++;
        this.posHistory.push({ x, y });
        if (this.posHistory.length > 60) this.posHistory.shift();
        if (this.frameCount % 3 !== 0) return;
        const maxSegs = this.trailSegments.length;
        const spacing = 3;
        const texKey = `starter_${starterKey || this._trailKey}_${dir || 'S'}`;
        for (let i = 0; i < maxSegs; i++) {
            const seg = this.trailSegments[i];
            const histIdx = this.posHistory.length - 1 - i * spacing;
            if (histIdx < 0) { seg.body.setVisible(false); seg.glow.setVisible(false); seg.shadow.setVisible(false); continue; }
            const pos = this.posHistory[histIdx];
            const t = i / maxSegs;
            const scale = Phaser.Math.Linear(0.35, 0.06, t);
            const alpha = Phaser.Math.Linear(0.5, 0.03, t);
            seg.body.setPosition(pos.x, pos.y).setScale(scale).setAlpha(alpha).setVisible(true);
            if (seg.body.texture.key !== texKey) seg.body.setTexture(texKey);
            if (this._rainbowTrail) seg.body.setTint(Phaser.Display.Color.HSLToColor(((Date.now()*0.002 + i*0.1) % 1), 1, 0.6).color);
            else seg.body.clearTint();
            seg.glow.setPosition(pos.x, pos.y).setAlpha(alpha * 0.12).setVisible(true);
            seg.shadow.setPosition(pos.x + SHADOW_OX, pos.y + SHADOW_OY).setScale(scale * 1.2, scale * 0.5).setVisible(true);
        }
    }

    initParticlePool() {
        this._particles = []; this._shockwaves = []; this._floats = [];
        for (let i = 0; i < 30; i++) {
            const p = this.scene.add.circle(0, 0, 4, 0xffffff, 0).setDepth(150).setVisible(false);
            this._particles.push({ gfx: p, active: false, vx: 0, vy: 0, life: 0, maxLife: 0 });
        }
        for (let i = 0; i < 4; i++) {
            const r = this.scene.add.circle(0, 0, 10, 0xffffff, 0).setStrokeStyle(3, 0xffffff, 0).setDepth(149).setVisible(false);
            this._shockwaves.push({ gfx: r, active: false, life: 0 });
        }
        for (let i = 0; i < 10; i++) {
            const t = this.scene.add.text(0, 0, '', { fontSize: `${13 * S}px`, color: '#0f0', fontFamily: 'Arial Black', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(150).setVisible(false);
            this._floats.push({ gfx: t, active: false, life: 0, vy: 0 });
        }
    }

    burstParticles(x, y, colour, count, speed, lifespan) {
        if (!this._particles) return; let spawned = 0;
        for (let i = 0; i < this._particles.length && spawned < count; i++) {
            const p = this._particles[i]; if (p.active) continue;
            const angle = (Math.PI * 2 / count) * spawned + Math.random() * 0.3;
            const spd = speed * (0.5 + Math.random() * 0.5);
            p.gfx.setPosition(x, y).setRadius(Phaser.Math.Between(3, 5)).setFillStyle(colour, 0.9).setScale(1).setAlpha(0.9).setVisible(true);
            p.vx = Math.cos(angle) * spd; p.vy = Math.sin(angle) * spd;
            p.life = 0; p.maxLife = lifespan / 1000; p.active = true; spawned++;
        }
    }
    shockwave(x, y, colour) {
        if (!this._shockwaves) return;
        for (const s of this._shockwaves) { if (s.active) continue; s.gfx.setPosition(x, y).setScale(1).setStrokeStyle(3, colour, 0.7).setVisible(true); s.life = 0; s.active = true; break; }
    }
    showFloat(x, y, msg, colour) {
        if (!this._floats) return;
        for (const f of this._floats) { if (f.active) continue; f.gfx.setPosition(x, y - 20).setText(msg).setColor(colour || '#00ff00').setAlpha(1).setVisible(true); f.life = 0; f.vy = -80; f.active = true; break; }
    }
    updateEffects(dt) {
        if (this._particles) for (const p of this._particles) { if (!p.active) continue; p.life += dt; if (p.life >= p.maxLife) { p.active = false; p.gfx.setVisible(false); continue; } const t = p.life / p.maxLife; p.gfx.x += p.vx * dt; p.gfx.y += p.vy * dt; p.gfx.setAlpha(0.9 * (1 - t)).setScale(1 - t * 0.7); }
        if (this._shockwaves) for (const s of this._shockwaves) { if (!s.active) continue; s.life += dt; if (s.life >= 0.4) { s.active = false; s.gfx.setVisible(false); continue; } const t = s.life / 0.4; s.gfx.setScale(1 + t * 4).setAlpha(0.7 * (1 - t)); }
        if (this._floats) for (const f of this._floats) { if (!f.active) continue; f.life += dt; if (f.life >= 0.6) { f.active = false; f.gfx.setVisible(false); continue; } f.gfx.y += f.vy * dt; f.gfx.setAlpha(1 - f.life / 0.6); }
    }

    createVignette() {
        const g = this.scene.add.graphics().setDepth(198).setScrollFactor(0);
        for (let i = 0; i < 10; i++) {
            const alpha = (i / 10) * 0.22;
            const thickness = 30 + i * 18;
            g.lineStyle(thickness, 0x000000, alpha);
            g.strokeRect(-thickness / 2, -thickness / 2, GAME_W + thickness, GAME_H + thickness);
        }
    }
    destroy() {
        this.trailSegments.forEach(s => { s.body.destroy(); s.glow.destroy(); s.shadow.destroy(); });
        this.trailSegments = []; this.posHistory = [];
    }
}

// ============================================================
// MENU — Sequential 2-Player Picker
// ============================================================
class MenuScene extends Phaser.Scene {
    constructor() { super('Menu'); }
    preload() {
        const mkTex = (key, r, colour, alpha = 1) => {
            const c = document.createElement('canvas'); c.width = r * 2; c.height = r * 2;
            const ctx = c.getContext('2d'); const col = Phaser.Display.Color.IntegerToColor(colour);
            ctx.globalAlpha = alpha; ctx.fillStyle = `rgb(${col.red},${col.green},${col.blue})`;
            ctx.beginPath(); ctx.arc(r, r, r, 0, Math.PI * 2); ctx.fill();
            if (!this.textures.exists(key)) this.textures.addCanvas(key, c);
        };
        mkTex('joystick_base', 50 * S, 0x333333, 0.4);
        mkTex('joystick_thumb', 22 * S, 0x666666, 0.7);
        new SpriteFactory(this).generateAll();
        // Ground textures
        this._genGroundTextures();
    }
    _genGroundTextures() {
        const themes = {
            grassland: { base: [20, 45, 20], dot: [30, 60, 30], grid: [25, 55, 25] },
            cave: { base: [20, 20, 30], dot: [35, 30, 45], grid: [25, 25, 35] },
            ocean: { base: [8, 20, 45], dot: [15, 35, 60], grid: [10, 25, 50] },
            volcanic: { base: [35, 10, 8], dot: [50, 20, 10], grid: [40, 15, 10] },
            space: { base: [5, 5, 12], dot: [20, 20, 40], grid: [8, 8, 18] },
            neon: { base: [5, 5, 5], dot: [0, 40, 35], grid: [0, 25, 25] },
        };
        Object.entries(themes).forEach(([name, t]) => {
            const key = `ground_${name}`;
            if (this.textures.exists(key)) return;
            const c = document.createElement('canvas'); c.width = 256; c.height = 256;
            const ctx = c.getContext('2d');
            ctx.fillStyle = `rgb(${t.base[0]},${t.base[1]},${t.base[2]})`; ctx.fillRect(0, 0, 256, 256);
            // Noise dots
            for (let i = 0; i < 200; i++) {
                ctx.fillStyle = `rgba(${t.dot[0]},${t.dot[1]},${t.dot[2]},${Math.random() * 0.12})`;
                ctx.fillRect(Math.random() * 256, Math.random() * 256, Math.random() * 3 + 1, Math.random() * 3 + 1);
            }
            // Subtle grid
            ctx.strokeStyle = `rgba(${t.grid[0]},${t.grid[1]},${t.grid[2]},0.06)`; ctx.lineWidth = 1;
            for (let x = 0; x < 256; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
            for (let y = 0; y < 256; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
            this.textures.addCanvas(key, c);
        });
    }
    create() {
        const cx = GAME_W / 2;
        this._p1Starter = null;
        this._p2Starter = null;

        this.add.rectangle(cx, GAME_H / 2, GAME_W, GAME_H, 0x0a0a1e);
        const g = this.add.graphics();
        g.lineStyle(1, 0x1a2a4e, 0.1);
        for (let x = 0; x < GAME_W; x += 80) { g.moveTo(x, 0); g.lineTo(x, GAME_H); }
        for (let y = 0; y < GAME_H; y += 80) { g.moveTo(0, y); g.lineTo(GAME_W, y); }
        g.strokePath();
        this.add.text(cx, 80, 'Snake\nClash', { fontSize: `${48 * S}px`, fontFamily: 'Arial Black, sans-serif', color: '#FFD700', align: 'center', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
        this._promptText = this.add.text(cx, 180, 'Player 1 — Choose Your Character!', { fontSize: `${20 * S}px`, color: '#44ff44', align: 'center' }).setOrigin(0.5);

        const starters = ['kayla', 'kirsten', 'kate', 'kyle'];
        this._starterSprites = [];
        this._starterZones = [];
        this._starterOverlays = [];

        const CHARACTER_STATS_INFO = {
            kayla:   { size: 'Biggest', speed: 'Slowest' },
            kirsten: { size: 'Medium',  speed: 'Normal' },
            kate:    { size: 'Small',   speed: 'Fast' },
            kyle:    { size: 'Smallest', speed: 'Fastest' },
        };

        starters.forEach((key, i) => {
            const pk = CHARACTER_DATA[key];
            const x = 120 + i * 210, y = 340;
            this.add.circle(x, y, 55 * S, pk.colour, 0.08);
            this.add.ellipse(x + 4, y + 50, 80, 30, 0x000000, 0.2);
            const sprite = this.add.image(x, y, `starter_${key}_S`).setScale(0.7);
            this._starterSprites.push(sprite);
            const hitZone = this.add.zone(x, y, 100 * S, 100 * S).setInteractive({ useHandCursor: true });
            this._starterZones.push(hitZone);
            this.tweens.add({ targets: sprite, y: y - 6, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            this.add.text(x, y + 65, pk.name, { fontSize: `${16 * S}px`, color: '#fff', fontFamily: 'Arial Black', align: 'center' }).setOrigin(0.5);
            this.add.text(x, y + 85, pk.type, { fontSize: `${11 * S}px`, color: '#ddd', align: 'center' }).setOrigin(0.5);
            this.add.text(x, y + 105, pk.superName, { fontSize: `${11 * S}px`, color: '#FFD700', align: 'center' }).setOrigin(0.5);
            // Size/speed info
            const stats = CHARACTER_STATS_INFO[key];
            this.add.text(x, y + 125, `${stats.size} | ${stats.speed}`, { fontSize: `${9 * S}px`, color: '#aaa', align: 'center' }).setOrigin(0.5);
            // Grey-out overlay (hidden initially)
            const overlay = this.add.rectangle(x, y, 100 * S, 100 * S, 0x000000, 0.6).setVisible(false);
            const p1Label = this.add.text(x, y - 20, 'P1', { fontSize: `${18 * S}px`, color: '#44ff44', fontFamily: 'Arial Black', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setVisible(false);
            this._starterOverlays.push({ overlay, p1Label });

            hitZone.on('pointerdown', () => {
                audioMgr.init();
                if (!this._p1Starter) {
                    // Player 1 picks
                    this._p1Starter = key;
                    overlay.setVisible(true);
                    p1Label.setVisible(true);
                    this._promptText.setText('Player 2 — Choose Your Character!').setColor('#00ccff');
                } else if (!this._p2Starter) {
                    // Player 2 picks (CAN pick same character)
                    this._p2Starter = key;
                    this.scene.start('Game', { starter1: this._p1Starter, starter2: this._p2Starter, level: 1, carryPL: 0, upgrades: [] });
                }
            });
            hitZone.on('pointerover', () => sprite.setScale(0.8));
            hitZone.on('pointerout', () => sprite.setScale(0.7));
        });
        this.add.text(cx, 510, 'P1: WASD + Q for Super | P2: Arrows + / for Super\nMobile: Left joystick P1, Right joystick P2', { fontSize: `${12 * S}px`, color: '#888', align: 'center', lineSpacing: 6 }).setOrigin(0.5);
    }
}

// ============================================================
// GAME SCENE — 2-Player Local Multiplayer
// ============================================================
class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }
    init(data) {
        this.starter1Key = data.starter1 || 'kayla';
        this.starter2Key = data.starter2 || 'kyle';
        this.currentLevel = data.level || 1;
        this.carryPL = data.carryPL || 0;
        this.playerUpgrades = data.upgrades || [];
    }

    _createPlayer(starterKey, x, y, playerNum) {
        const pk = CHARACTER_DATA[starterKey];
        const basePL = 10 + (this.currentLevel - 1) * 10 + this.carryPL;

        // Character-specific stats
        let plBonus = 0, baseSpeed = 240, scaleMult = 1.0;
        if (starterKey === 'kayla')   { plBonus = 5;  baseSpeed = 200; scaleMult = 1.2; }
        if (starterKey === 'kirsten') { plBonus = 0;  baseSpeed = 240; scaleMult = 1.0; }
        if (starterKey === 'kate')    { plBonus = 0;  baseSpeed = 270; scaleMult = 0.85; }
        if (starterKey === 'kyle')    { plBonus = -3; baseSpeed = 300; scaleMult = 0.7; }

        const p = {
            x, y, pl: basePL + plBonus, hp: 100, aura: 100, auraMax: 100,
            speed: baseSpeed, baseSpeed: baseSpeed,
            dir: { x: 0, y: -1 },
            superActive: false, superTimer: 0,
            shielded: false, shieldTimer: 0,
            speedBoosted: false, speedTimer: 0,
            superPL: 0, starterKey,
            combo: 0, maxCombo: 0,
            iFrames: 0,
            ghost: false, ghostTimer: 0,
            currentDir: 'N',
            playerNum,
            scaleMult
        };
        // Apply upgrades
        this.playerUpgrades.forEach(u => {
            if (u === 'aura') p.auraMax += 30;
            if (u === 'speed') p.baseSpeed += 40;
            if (u === 'pl') p.pl += 20;
        });
        p.aura = p.auraMax;
        p.speed = p.baseSpeed;

        // Graphics
        p.shadow = this.add.ellipse(x + SHADOW_OX, y + SHADOW_OY, 60, 24, 0x000000, 0.25).setDepth(3);
        p.glow = this.add.circle(x, y, 48, pk.colour, 0.10).setDepth(8);
        p.gfx = this.add.image(x, y, `starter_${starterKey}_N`).setScale(0.5 * scaleMult).setDepth(10);
        p.plText = this.add.text(x, y + 30, p.pl.toString(), { fontSize: `${11 * S}px`, color: '#fff', fontFamily: 'Arial Black', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(11);
        p.shield = this.add.circle(x, y, 22 * S, 0x00ffff, 0).setStrokeStyle(3, 0x00ffff, 0).setDepth(9);

        // Player number indicator
        const pnColour = playerNum === 1 ? '#44ff44' : '#00ccff';
        p.pnLabel = this.add.text(x, y - 40, `P${playerNum}`, { fontSize: `${10 * S}px`, color: pnColour, fontFamily: 'Arial Black', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(12);

        // Trail VFX (own pool per player)
        p.vfx = new VFXManager(this);
        p.vfx.initTrailPool(starterKey, pk.colour);

        return p;
    }

    create() {
        const pk1 = CHARACTER_DATA[this.starter1Key];
        const pk2 = CHARACTER_DATA[this.starter2Key];
        const lvlIdx = Math.min(this.currentLevel - 1, LEVEL_CONFIGS.length - 1);
        const lvlCfg = this.getLevelConfig(lvlIdx);

        this.input.once('pointerdown', () => audioMgr.init());
        this.input.keyboard.once('keydown', () => audioMgr.init());
        this.audio = audioMgr;

        // World bounds
        this.arenaLeft = 100; this.arenaTop = 100;
        this.arenaRight = WORLD_W - 100; this.arenaBottom = WORLD_H - 100;
        this.arenaW = this.arenaRight - this.arenaLeft;
        this.arenaH = this.arenaBottom - this.arenaTop;

        // Ground texture (tiled)
        const theme = this._getTheme();
        const groundKey = `ground_${theme}`;
        if (this.textures.exists(groundKey)) {
            this.add.tileSprite(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, groundKey).setDepth(0);
        } else {
            this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x0a0a1e).setDepth(0);
        }

        // World border glow
        const borderG = this.add.graphics().setDepth(2);
        [0.4, 0.2, 0.1].forEach((alpha, i) => {
            const off = (i + 1) * 4;
            borderG.lineStyle(3, this._getThemeColour(), alpha);
            borderG.strokeRect(this.arenaLeft - off, this.arenaTop - off, this.arenaW + off * 2, this.arenaH + off * 2);
        });
        borderG.lineStyle(3, this._getThemeColour(), 0.7);
        borderG.strokeRect(this.arenaLeft, this.arenaTop, this.arenaW, this.arenaH);

        // Danger zone indicator
        const dz = this.add.graphics().setDepth(1);
        dz.fillStyle(0xff0000, 0.03);
        dz.fillRect(this.arenaLeft, this.arenaTop, this.arenaW, 100);
        dz.fillRect(this.arenaLeft, this.arenaBottom - 100, this.arenaW, 100);
        dz.fillRect(this.arenaLeft, this.arenaTop, 100, this.arenaH);
        dz.fillRect(this.arenaRight - 100, this.arenaTop, 100, this.arenaH);

        // Terrain decorations
        this._createTerrainDecor(theme);

        // Shared VFX (particles, shockwaves, floats)
        this.sharedVfx = new VFXManager(this);
        this.sharedVfx.createVignette();
        this.sharedVfx.initParticlePool();

        // Create both players
        this.p1 = this._createPlayer(this.starter1Key, WORLD_W / 2 - 100, WORLD_H / 2, 1);
        this.p2 = this._createPlayer(this.starter2Key, WORLD_W / 2 + 100, WORLD_H / 2, 2);
        this.players = [this.p1, this.p2];

        // Camera midpoint
        this.midpoint = this.add.circle(WORLD_W / 2, WORLD_H / 2, 1, 0x000000, 0).setDepth(0);
        this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
        this.cameras.main.startFollow(this.midpoint, true, 0.08, 0.08);
        this.cameras.main.setZoom(1.0);

        // Enemies + obstacles + power-ups
        this.enemies = [];
        for (let i = 0; i < lvlCfg.enemyCount; i++) this.spawnEnemy(lvlCfg);
        this.obstacles = []; this.createObstacles();
        this.powerUps = []; this.powerUpTimer = 0;
        for (let i = 0; i < 5; i++) this.spawnPowerUp();

        this.levelTime = 60; this.phase = 'arena'; this.boss = null; this.score = 0;

        const rates = [8, 8, 6, 6, 5];
        this.auraRegenRate = rates[Math.min(lvlIdx, rates.length - 1)];

        // Input — Split Controls
        this.p1Keys = this.input.keyboard.addKeys('W,A,S,D');
        this.p1SuperKey = this.input.keyboard.addKey('Q');
        this.p2Keys = this.input.keyboard.createCursorKeys();
        this.p2SuperKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FORWARD_SLASH);
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.p1SuperKey.on('down', () => this.activateSuperpower(this.p1));
        this.p2SuperKey.on('down', () => this.activateSuperpower(this.p2));
        this.escKey.on('down', () => this.togglePause());

        // Mobile joystick — P1 left side, P2 right side
        this.joystick1Active = false;
        this.joystick2Active = false;
        this.joystick1Base = this.add.image(150, GAME_H - 130, 'joystick_base').setAlpha(0.25).setDepth(100).setScrollFactor(0);
        this.joystick1Thumb = this.add.image(150, GAME_H - 130, 'joystick_thumb').setAlpha(0.45).setDepth(101).setScrollFactor(0);
        this.joystick2Base = this.add.image(GAME_W - 150, GAME_H - 130, 'joystick_base').setAlpha(0.25).setDepth(100).setScrollFactor(0);
        this.joystick2Thumb = this.add.image(GAME_W - 150, GAME_H - 130, 'joystick_thumb').setAlpha(0.45).setDepth(101).setScrollFactor(0);

        // SP buttons
        this.sp1Button = this.add.circle(80, GAME_H - 230, 28 * S, pk1.colour, 0.3).setStrokeStyle(3, 0xffd700, 0.5).setInteractive().setDepth(100).setScrollFactor(0);
        this.add.text(80, GAME_H - 230, 'SP', { fontSize: `${12 * S}px`, color: '#FFD700', fontFamily: 'Arial Black' }).setOrigin(0.5).setDepth(101).setScrollFactor(0);
        this.sp1Button.on('pointerdown', () => this.activateSuperpower(this.p1));

        this.sp2Button = this.add.circle(GAME_W - 80, GAME_H - 230, 28 * S, pk2.colour, 0.3).setStrokeStyle(3, 0xffd700, 0.5).setInteractive().setDepth(100).setScrollFactor(0);
        this.add.text(GAME_W - 80, GAME_H - 230, 'SP', { fontSize: `${12 * S}px`, color: '#FFD700', fontFamily: 'Arial Black' }).setOrigin(0.5).setDepth(101).setScrollFactor(0);
        this.sp2Button.on('pointerdown', () => this.activateSuperpower(this.p2));

        // Joystick pointer handling
        this.input.on('pointerdown', (ptr) => {
            if (ptr.x < GAME_W / 2 && ptr.y > GAME_H * 0.5) {
                this.joystick1Active = true;
                this.joystick1Base.setPosition(ptr.x, ptr.y).setAlpha(0.4);
                this.joystick1Thumb.setPosition(ptr.x, ptr.y).setAlpha(0.7);
            } else if (ptr.x >= GAME_W / 2 && ptr.y > GAME_H * 0.5) {
                this.joystick2Active = true;
                this.joystick2Base.setPosition(ptr.x, ptr.y).setAlpha(0.4);
                this.joystick2Thumb.setPosition(ptr.x, ptr.y).setAlpha(0.7);
            }
        });
        this.input.on('pointermove', (ptr) => {
            if (!ptr.isDown) return;
            if (this.joystick1Active && ptr.x < GAME_W / 2) {
                const dx = ptr.x - this.joystick1Base.x, dy = ptr.y - this.joystick1Base.y, dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 5) { const clamp = Math.min(dist, 80), nx = dx / dist, ny = dy / dist; this.joystick1Thumb.setPosition(this.joystick1Base.x + nx * clamp, this.joystick1Base.y + ny * clamp); this.p1.dir.x = nx; this.p1.dir.y = ny; }
            }
            if (this.joystick2Active && ptr.x >= GAME_W / 2) {
                const dx = ptr.x - this.joystick2Base.x, dy = ptr.y - this.joystick2Base.y, dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 5) { const clamp = Math.min(dist, 80), nx = dx / dist, ny = dy / dist; this.joystick2Thumb.setPosition(this.joystick2Base.x + nx * clamp, this.joystick2Base.y + ny * clamp); this.p2.dir.x = nx; this.p2.dir.y = ny; }
            }
        });
        this.input.on('pointerup', (ptr) => {
            if (this.joystick1Active && ptr.x < GAME_W / 2) {
                this.joystick1Active = false;
                this.joystick1Thumb.setPosition(this.joystick1Base.x, this.joystick1Base.y);
                this.joystick1Base.setAlpha(0.25); this.joystick1Thumb.setAlpha(0.45);
            }
            if (this.joystick2Active && ptr.x >= GAME_W / 2) {
                this.joystick2Active = false;
                this.joystick2Thumb.setPosition(this.joystick2Base.x, this.joystick2Base.y);
                this.joystick2Base.setAlpha(0.25); this.joystick2Thumb.setAlpha(0.45);
            }
        });

        // HUD
        this.createHUD(pk1, pk2);

        // Minimap
        this.createMinimap();

        // Splash
        const splash = this.add.text(GAME_W / 2, GAME_H / 2 - 40, `LEVEL ${this.currentLevel}`, { fontSize: `${40 * S}px`, color: '#FFD700', fontFamily: 'Arial Black', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(200).setScrollFactor(0);
        const themeName = this._getTheme().toUpperCase();
        const thSplash = this.add.text(GAME_W / 2, GAME_H / 2 + 20, themeName, { fontSize: `${18 * S}px`, color: '#aaa', fontFamily: 'Arial Black' }).setOrigin(0.5).setDepth(200).setScrollFactor(0);
        this.tweens.add({ targets: [splash, thSplash], alpha: 0, y: '-=60', duration: 2000, ease: 'Power2', onComplete: () => { splash.destroy(); thSplash.destroy(); } });

        // Pause
        this.isPaused = false;
        this.pauseOverlay = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.7).setDepth(300).setVisible(false).setScrollFactor(0);
        this.pauseLabel = this.add.text(GAME_W / 2, GAME_H / 2, 'PAUSED\n\nTap or press ESC', { fontSize: `${28 * S}px`, color: '#fff', fontFamily: 'Arial Black', align: 'center' }).setOrigin(0.5).setDepth(301).setVisible(false).setScrollFactor(0);

        // Warning + duel bar
        this.warningText = this.add.text(GAME_W / 2, 120, '', { fontSize: `${18 * S}px`, color: '#FF4444', fontFamily: 'Arial Black', align: 'center', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(150).setAlpha(0).setScrollFactor(0);
        this.duelBarBg = this.add.rectangle(GAME_W / 2, 90, 600, 32, 0x222222).setStrokeStyle(2, 0x444444).setDepth(200).setVisible(false).setScrollFactor(0);
        this.duelBarPlayer = this.add.rectangle(GAME_W / 2 - 150, 90, 300, 26, 0x44ff44).setOrigin(0.5).setDepth(201).setVisible(false).setScrollFactor(0);
        this.duelBarBoss = this.add.rectangle(GAME_W / 2 + 150, 90, 300, 26, 0x9400D3).setOrigin(0.5).setDepth(201).setVisible(false).setScrollFactor(0);
        this.duelTextPlayer = this.add.text(GAME_W / 2 - 280, 90, '', { fontSize: `${10 * S}px`, color: '#fff', fontFamily: 'Arial Black' }).setOrigin(0.5).setDepth(202).setVisible(false).setScrollFactor(0);
        this.duelTextBoss = this.add.text(GAME_W / 2 + 280, 90, '', { fontSize: `${10 * S}px`, color: '#fff', fontFamily: 'Arial Black' }).setOrigin(0.5).setDepth(202).setVisible(false).setScrollFactor(0);

        this.audio.playArenaMusic();
        this.events.on('shutdown', () => {
            this.players.forEach(p => p.vfx.destroy());
            this.sharedVfx.destroy();
            this.audio.stopAll();
        });
    }

    _getTheme() {
        const l = this.currentLevel;
        if (l <= 2) return 'grassland'; if (l <= 4) return 'cave'; if (l <= 6) return 'ocean';
        if (l <= 8) return 'volcanic'; if (l <= 10) return 'space'; return 'neon';
    }
    _getThemeColour() {
        const cols = { grassland: 0x2d5a2d, cave: 0x3a2a4a, ocean: 0x1a4a5a, volcanic: 0x5a1a0a, space: 0x2a1a4a, neon: 0x00aaaa };
        return cols[this._getTheme()] || 0x0f3460;
    }

    _createTerrainDecor(theme) {
        const g = this.add.graphics().setDepth(1);
        const count = 40;
        for (let i = 0; i < count; i++) {
            const x = Phaser.Math.Between(this.arenaLeft + 50, this.arenaRight - 50);
            const y = Phaser.Math.Between(this.arenaTop + 50, this.arenaBottom - 50);
            if (theme === 'grassland') { g.fillStyle(0x1a5a1a, 0.15); g.fillTriangle(x, y - 14, x - 10, y + 6, x + 10, y + 6); g.fillStyle(0x2d1a0a, 0.12); g.fillRect(x - 1, y + 4, 2, 8); }
            else if (theme === 'cave') { const cc = [0x9966ff, 0x66ccff, 0xff66ff][i % 3]; g.fillStyle(cc, 0.08); g.fillRect(x - 2, y - 6, 4, 12); g.fillTriangle(x - 3, y - 6, x + 3, y - 6, x, y - 12); }
            else if (theme === 'ocean') { g.fillStyle([0xff6666, 0xff9966, 0xffcc66][i % 3], 0.08); g.fillCircle(x, y, 4); g.fillCircle(x + 4, y - 4, 3); }
            else if (theme === 'volcanic') { g.fillStyle(0x1a0a0a, 0.15); g.fillCircle(x, y, Phaser.Math.Between(5, 12)); }
            else if (theme === 'space') { g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.05, 0.25)); g.fillCircle(x, y, Phaser.Math.FloatBetween(0.5, 2)); }
            else if (theme === 'neon') { g.lineStyle(1, 0x00ffff, 0.04); g.lineBetween(x, y, x + Phaser.Math.Between(-30, 30), y); }
        }
    }

    getLevelConfig(idx) {
        if (idx < LEVEL_CONFIGS.length) return LEVEL_CONFIGS[idx];
        const base = LEVEL_CONFIGS[LEVEL_CONFIGS.length - 1]; const extra = idx - LEVEL_CONFIGS.length + 1;
        return { enemyPLRange: [base.enemyPLRange[0] + extra * 15, base.enemyPLRange[1] + extra * 15], bossMulti: base.bossMulti + extra * 0.2, enemyCount: base.enemyCount + extra * 2, bossSuper: true };
    }

    createHUD(pk1, pk2) {
        const y0 = 12, barW = 180, barH = 16;
        this.add.rectangle(GAME_W / 2, y0 + 35, GAME_W, 82, 0x000000, 0.4).setDepth(199).setScrollFactor(0);

        // P1 HUD — left side
        this.hud1 = {};
        this.hud1.name = this.add.text(20, y0, `P1 ${pk1.name}`, { fontSize: `${12 * S}px`, color: '#44ff44', fontFamily: 'Arial Black' }).setDepth(200).setScrollFactor(0);
        this.hud1.pl = this.add.text(20, y0 + 22, 'PL: 10', { fontSize: `${11 * S}px`, color: '#FFD700', fontFamily: 'Arial Black' }).setDepth(200).setScrollFactor(0);
        this.add.circle(24, y0 + 48, 6, 0xff4444).setDepth(200).setScrollFactor(0);
        this.add.rectangle(38 + barW / 2, y0 + 48, barW, barH, 0x1a1a1a).setStrokeStyle(1, 0x333333).setDepth(200).setScrollFactor(0);
        this.hud1.hpBar = this.add.rectangle(38, y0 + 48, barW, barH - 4, 0x44ff44).setOrigin(0, 0.5).setDepth(201).setScrollFactor(0);
        this.add.circle(24, y0 + 66, 6, 0x4488ff).setDepth(200).setScrollFactor(0);
        this.add.rectangle(38 + barW / 2, y0 + 66, barW, barH, 0x1a1a1a).setStrokeStyle(1, 0x333333).setDepth(200).setScrollFactor(0);
        this.hud1.auraBar = this.add.rectangle(38, y0 + 66, barW, barH - 4, 0x4488ff).setOrigin(0, 0.5).setDepth(201).setScrollFactor(0);

        // P2 HUD — right side
        this.hud2 = {};
        const rx = GAME_W - 230;
        this.hud2.name = this.add.text(rx, y0, `P2 ${pk2.name}`, { fontSize: `${12 * S}px`, color: '#00ccff', fontFamily: 'Arial Black' }).setDepth(200).setScrollFactor(0);
        this.hud2.pl = this.add.text(rx, y0 + 22, 'PL: 10', { fontSize: `${11 * S}px`, color: '#FFD700', fontFamily: 'Arial Black' }).setDepth(200).setScrollFactor(0);
        this.add.circle(rx + 4, y0 + 48, 6, 0xff4444).setDepth(200).setScrollFactor(0);
        this.add.rectangle(rx + 18 + barW / 2, y0 + 48, barW, barH, 0x1a1a1a).setStrokeStyle(1, 0x333333).setDepth(200).setScrollFactor(0);
        this.hud2.hpBar = this.add.rectangle(rx + 18, y0 + 48, barW, barH - 4, 0x44ff44).setOrigin(0, 0.5).setDepth(201).setScrollFactor(0);
        this.add.circle(rx + 4, y0 + 66, 6, 0x4488ff).setDepth(200).setScrollFactor(0);
        this.add.rectangle(rx + 18 + barW / 2, y0 + 66, barW, barH, 0x1a1a1a).setStrokeStyle(1, 0x333333).setDepth(200).setScrollFactor(0);
        this.hud2.auraBar = this.add.rectangle(rx + 18, y0 + 66, barW, barH - 4, 0x4488ff).setOrigin(0, 0.5).setDepth(201).setScrollFactor(0);

        // Centre: Timer + Level + Score
        this.hudTimer = this.add.text(GAME_W / 2, y0, '60', { fontSize: `${22 * S}px`, color: '#fff', fontFamily: 'Arial Black' }).setOrigin(0.5, 0).setDepth(200).setScrollFactor(0);
        this.hudLevel = this.add.text(GAME_W / 2, y0 + 42, `Lv.${this.currentLevel}`, { fontSize: `${11 * S}px`, color: '#888' }).setOrigin(0.5, 0).setDepth(200).setScrollFactor(0);
        this.hudScore = this.add.text(GAME_W / 2, y0 + 60, 'Score: 0', { fontSize: `${10 * S}px`, color: '#aaa' }).setOrigin(0.5, 0).setDepth(200).setScrollFactor(0);
    }

    createMinimap() {
        const mmW = 120, mmH = 120, mx = GAME_W - mmW - 10, my = GAME_H - mmH - 160;
        this.minimapBg = this.add.rectangle(mx + mmW / 2, my + mmH / 2, mmW, mmH, 0x000000, 0.5).setStrokeStyle(1, 0x444444).setDepth(200).setScrollFactor(0);
        this.minimapGfx = this.add.graphics().setDepth(201).setScrollFactor(0);
        this._mmX = mx; this._mmY = my; this._mmW = mmW; this._mmH = mmH;
    }

    updateMinimap() {
        const g = this.minimapGfx; g.clear();
        const sx = this._mmW / WORLD_W, sy = this._mmH / WORLD_H;
        const maxPlayerPL = Math.max(this.p1.pl + this.p1.superPL, this.p2.pl + this.p2.superPL);
        // Enemies
        this.enemies.forEach(e => {
            const col = e.isElite ? 0xff0000 : (e.pl > maxPlayerPL ? 0xff4444 : 0xffff44);
            g.fillStyle(col, 0.8); g.fillCircle(this._mmX + e.x * sx, this._mmY + e.y * sy, e.isBoss ? 4 : 2);
        });
        // P1 — green dot
        g.fillStyle(0x44ff44, 1); g.fillCircle(this._mmX + this.p1.x * sx, this._mmY + this.p1.y * sy, 3);
        // P2 — cyan dot
        g.fillStyle(0x00ccff, 1); g.fillCircle(this._mmX + this.p2.x * sx, this._mmY + this.p2.y * sy, 3);
        // Power-ups
        this.powerUps.forEach(p => { g.fillStyle(0xffffff, 0.5); g.fillCircle(this._mmX + p.x * sx, this._mmY + p.y * sy, 1.5); });
    }

    createObstacles() {
        const theme = this._getTheme();
        const count = Math.min(5 + this.currentLevel, 12);
        const styles = { grassland: { c: 0x2d5a2d, e: '🌳' }, cave: { c: 0x4a3a5a, e: '🪨' }, ocean: { c: 0x1a4a6a, e: '🪸' }, volcanic: { c: 0x4a1a0a, e: '🌋' }, space: { c: 0x3a3a5a, e: '☄️' }, neon: { c: 0x003333, e: '⬡' } };
        const st = styles[theme] || styles.grassland;
        for (let i = 0; i < count; i++) {
            const x = Phaser.Math.Between(this.arenaLeft + 200, this.arenaRight - 200);
            const y = Phaser.Math.Between(this.arenaTop + 200, this.arenaBottom - 200);
            const w = Phaser.Math.Between(50, 100), h = Phaser.Math.Between(50, 80);
            const shadow = this.add.ellipse(x + SHADOW_OX, y + SHADOW_OY + h / 3, w * 1.1, h * 0.4, 0x000000, 0.2).setDepth(2);
            const gfx = this.add.rectangle(x, y, w, h, st.c, 0.6).setStrokeStyle(2, st.c, 0.9).setDepth(3);
            const label = this.add.text(x, y, st.e, { fontSize: `${16 * S}px` }).setOrigin(0.5).setDepth(3);
            this.obstacles.push({ x, y, w, h, gfx, label, shadow });
        }
    }

    spawnEnemy(lvlCfg, forceElite) {
        const maxPlayerPL = Math.max(
            this.p1 ? this.p1.pl + this.p1.superPL : 10,
            this.p2 ? this.p2.pl + this.p2.superPL : 10
        );
        let pl; const roll = Math.random();
        if (roll < 0.25) pl = Math.floor(maxPlayerPL * Phaser.Math.FloatBetween(0.8, 1.3));
        else if (roll < 0.55) pl = Math.floor(maxPlayerPL * Phaser.Math.FloatBetween(0.5, 0.9));
        else pl = Phaser.Math.Between(lvlCfg.enemyPLRange[0], Math.max(lvlCfg.enemyPLRange[1], Math.floor(maxPlayerPL * 0.6)));
        pl = Math.max(3, pl);
        const isElite = forceElite || (this.levelTime < 45 && this.levelTime > 15 && Math.random() < 0.08);
        const x = Phaser.Math.Between(this.arenaLeft + 80, this.arenaRight - 80);
        const y = Phaser.Math.Between(this.arenaTop + 80, this.arenaBottom - 80);
        const hue = Phaser.Math.Between(0, 359);
        const colour = isElite ? 0xff0033 : Phaser.Display.Color.HSLToColor(hue / 360, 0.6, 0.5).color;
        const angle = Phaser.Math.Angle.Random();
        const speed = isElite ? Phaser.Math.Between(100, 180) : Phaser.Math.Between(60, 140);
        if (isElite) pl = Math.floor(maxPlayerPL * 3);
        const radius = Math.min(28, 16 + pl * 0.2);
        const creatureType = SpriteFactory.getEnemyType(hue);
        const dir = SpriteFactory.getDir(Math.cos(angle), Math.sin(angle));
        const ring = this.add.circle(x, y, radius + 8, isElite ? 0xff0033 : colour, isElite ? 0.3 : 0.12).setDepth(4);
        const shadow = this.add.ellipse(x + SHADOW_OX, y + SHADOW_OY, radius * 2, radius * 0.8, 0x000000, 0.2).setDepth(2);
        const texKey = isElite ? `enemy_${creatureType}_boss_${dir}` : `enemy_${creatureType}_${dir}`;
        const spriteScale = Math.min(0.7, 0.25 + pl * 0.002);
        const gfx = this.add.image(x, y, texKey).setScale(spriteScale).setDepth(5);
        if (isElite) gfx.setTint(0xff4444);
        const label = isElite ? '💀' : pl.toString();
        const text = this.add.text(x, y + radius + 10, label, { fontSize: `${Math.max(14, 9 * S)}px`, color: isElite ? '#ff0000' : '#fff', fontFamily: 'Arial Black', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(8);
        if (isElite) this.tweens.add({ targets: ring, alpha: 0.1, duration: 400, yoyo: true, repeat: -1 });
        this.enemies.push({ x, y, pl, colour, speed, radius, creatureType, currentDir: dir, dir: { x: Math.cos(angle), y: Math.sin(angle) }, gfx, text, ring, shadow, isBoss: false, isElite, burnTimer: 0, burnDmg: 0, slowTimer: 0, slowFactor: 1, stunTimer: 0 });
    }

    spawnPowerUp() {
        const type = Phaser.Utils.Array.GetRandom(POWERUP_TYPES);
        const x = Phaser.Math.Between(this.arenaLeft + 80, this.arenaRight - 80);
        const y = Phaser.Math.Between(this.arenaTop + 80, this.arenaBottom - 80);
        const shadow = this.add.ellipse(x + 4, y + 12, 30, 10, 0x000000, 0.15).setDepth(2);
        const glow = this.add.circle(x, y, 16 * S, type.colour, 0.12).setDepth(3);
        const gfx = this.add.circle(x, y, 10 * S, type.colour, 0.7).setStrokeStyle(2, 0xffffff, 0.4).setDepth(4);
        const text = this.add.text(x, y, type.emoji, { fontSize: `${14 * S}px` }).setOrigin(0.5).setDepth(5);
        this.tweens.add({ targets: [gfx, text, glow, shadow], y: '-=5', duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.powerUps.push({ x, y, type, gfx, text, glow, shadow });
    }

    activateSuperpower(p) {
        if (this.isPaused || p.superActive || p.ghost) return;
        const pk = CHARACTER_DATA[p.starterKey];

        // Character-specific costs
        let cost = 30;
        if (p.starterKey === 'kayla')   cost = 35;
        if (p.starterKey === 'kirsten') cost = 30;
        if (p.starterKey === 'kate')    cost = 25;
        if (p.starterKey === 'kyle')    cost = 40;

        if (p.aura < cost) return;
        p.aura -= cost;

        this.audio.sfxSuperpower();

        // === KAYLA — Football Kick: Instant massive damage to nearest enemy ===
        if (p.starterKey === 'kayla') {
            let nearest = null, nearDist = Infinity;
            for (const e of this.enemies) {
                const d = Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y);
                if (d < nearDist) { nearDist = d; nearest = e; }
            }
            if (nearest) {
                const playerPL = p.pl + p.superPL;
                // Massive damage: remove 60% of enemy PL, or kill if player PL > enemy PL * 0.4
                if (playerPL > nearest.pl * 0.4) {
                    // Kill — absorb
                    const absorbed = Math.floor(nearest.pl * 0.5);
                    p.pl += absorbed;
                    this.score += nearest.pl;
                    this.floatText(nearest.x, nearest.y, `⚽ KICKED! +${absorbed}`, '#FF1493');
                    this.sharedVfx.burstParticles(nearest.x, nearest.y, 0xFF1493, 12, 180, 500);
                    this.sharedVfx.shockwave(nearest.x, nearest.y, 0xFF1493);
                    if (nearest.isBoss && this.phase === 'duel') {
                        this.duelWon(nearest);
                    } else {
                        this.destroyEnemy(nearest, this.enemies.indexOf(nearest));
                    }
                } else {
                    // Remove 60% PL
                    const dmg = Math.floor(nearest.pl * 0.6);
                    nearest.pl -= dmg;
                    nearest.text.setText(nearest.pl.toString());
                    this.floatText(nearest.x, nearest.y, `⚽ -${dmg}`, '#FF1493');
                    this.sharedVfx.burstParticles(nearest.x, nearest.y, 0xFF1493, 10, 150, 400);
                    this.sharedVfx.shockwave(nearest.x, nearest.y, 0xFF1493);
                }
                // Knockback on enemy
                if (nearest && this.enemies.includes(nearest)) {
                    const angle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
                    nearest.x += Math.cos(angle) * 120;
                    nearest.y += Math.sin(angle) * 120;
                    nearest.x = Phaser.Math.Clamp(nearest.x, this.arenaLeft + nearest.radius, this.arenaRight - nearest.radius);
                    nearest.y = Phaser.Math.Clamp(nearest.y, this.arenaTop + nearest.radius, this.arenaBottom - nearest.radius);
                }
            }
            // Football emoji float
            this.floatText(p.x, p.y - 30, '⚽', '#FFFFFF');
            this.cameras.main.shake(150, 0.008);
        }

        // === KIRSTEN — Fire Storm: AoE burn over 5 seconds ===
        else if (p.starterKey === 'kirsten') {
            p.superActive = true;
            p.superTimer = pk.superDuration;
            p.gfx.setTint(0xFF4500);
            const burnRadius = 300;
            const burnDmgPerSec = p.pl * 0.15;
            for (const e of this.enemies) {
                const d = Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y);
                if (d < burnRadius) {
                    e.burnTimer = 5000;
                    e.burnDmg = burnDmgPerSec;
                    e.gfx.setTint(0xff3300);
                    this.floatText(e.x, e.y, '🔥', '#FF4500');
                }
            }
            this.sharedVfx.burstParticles(p.x, p.y, 0xFF4500, 15, 160, 600);
            this.sharedVfx.burstParticles(p.x, p.y, 0xFFD700, 10, 120, 500);
            this.sharedVfx.shockwave(p.x, p.y, 0xFF4500);
            this.cameras.main.flash(200, 255, 100, 0);
        }

        // === KATE — Book Blast (Dizzy): AoE slow ===
        else if (p.starterKey === 'kate') {
            p.superActive = true;
            p.superTimer = pk.superDuration;
            p.gfx.setTint(0x9370DB);
            const slowRadius = 350;
            for (const e of this.enemies) {
                const d = Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y);
                if (d < slowRadius) {
                    e.slowTimer = 4000;
                    e.slowFactor = 0.2;
                    this.floatText(e.x, e.y, '📖', '#9370DB');
                    this.floatText(e.x, e.y + 20, '😵', '#9370DB');
                }
            }
            this.sharedVfx.burstParticles(p.x, p.y, 0x9370DB, 15, 150, 600);
            this.sharedVfx.shockwave(p.x, p.y, 0x9370DB);
            this.cameras.main.flash(200, 147, 112, 219);
        }

        // === KYLE — Thunderball: ALL enemies stunned + damage ===
        else if (p.starterKey === 'kyle') {
            p.superActive = true;
            p.superTimer = pk.superDuration;
            p.gfx.setTint(0x00BFFF);
            const thunderDmg = Math.floor(p.pl * 0.1);
            for (const e of this.enemies) {
                e.stunTimer = 3000;
                e.pl = Math.max(1, e.pl - thunderDmg);
                e.text.setText(e.isBoss ? e.pl.toString() : (e.isElite ? '💀' : e.pl.toString()));
                this.floatText(e.x, e.y, '⚡', '#FFD700');
            }
            this.sharedVfx.burstParticles(p.x, p.y, 0xFFD700, 20, 200, 700);
            this.sharedVfx.shockwave(p.x, p.y, 0xFFD700);
            this.cameras.main.flash(300, 255, 255, 0);
        }
    }

    togglePause() { this.isPaused = !this.isPaused; this.pauseOverlay.setVisible(this.isPaused); this.pauseLabel.setVisible(this.isPaused); }
    floatText(x, y, msg, colour) { this.sharedVfx.showFloat(x, y, msg, colour); }

    update(time, delta) {
        try { this._update(time, delta); } catch (e) { if (!this._errShown) { this._errShown = true; console.error('GAME CRASH:', e); } }
    }

    _update(time, delta) {
        if (this.isPaused) return;
        const dt = delta / 1000;

        // P1 input (WASD)
        if (!this.joystick1Active) {
            let dx1 = 0, dy1 = 0;
            if (this.p1Keys.A.isDown) dx1 = -1;
            if (this.p1Keys.D.isDown) dx1 = 1;
            if (this.p1Keys.W.isDown) dy1 = -1;
            if (this.p1Keys.S.isDown) dy1 = 1;
            if (dx1 !== 0 || dy1 !== 0) { const len = Math.sqrt(dx1 * dx1 + dy1 * dy1); this.p1.dir.x = dx1 / len; this.p1.dir.y = dy1 / len; }
        }

        // P2 input (arrows)
        if (!this.joystick2Active) {
            let dx2 = 0, dy2 = 0;
            if (this.p2Keys.left.isDown) dx2 = -1;
            if (this.p2Keys.right.isDown) dx2 = 1;
            if (this.p2Keys.up.isDown) dy2 = -1;
            if (this.p2Keys.down.isDown) dy2 = 1;
            if (dx2 !== 0 || dy2 !== 0) { const len = Math.sqrt(dx2 * dx2 + dy2 * dy2); this.p2.dir.x = dx2 / len; this.p2.dir.y = dy2 / len; }
        }

        // Move + update both players
        this.players.forEach(p => {
            if (p.ghost) {
                // Ghost movement (slower, semi-transparent)
                const ghostSpd = p.speed * 0.6;
                p.x += p.dir.x * ghostSpd * dt;
                p.y += p.dir.y * ghostSpd * dt;
            } else {
                const spd = p.speedBoosted ? p.speed * 1.5 : p.speed;
                p.x += p.dir.x * spd * dt;
                p.y += p.dir.y * spd * dt;
            }
            p.x = Phaser.Math.Clamp(p.x, this.arenaLeft + 32, this.arenaRight - 32);
            p.y = Phaser.Math.Clamp(p.y, this.arenaTop + 32, this.arenaBottom - 32);

            // Obstacle collision
            for (const o of this.obstacles) {
                const dx = p.x - o.x, dy = p.y - o.y;
                const hW = o.w / 2 + 20, hH = o.h / 2 + 20;
                if (Math.abs(dx) < hW && Math.abs(dy) < hH) {
                    const ovX = hW - Math.abs(dx), ovY = hH - Math.abs(dy);
                    if (ovX < ovY) p.x += (dx > 0 ? ovX : -ovX);
                    else p.y += (dy > 0 ? ovY : -ovY);
                }
            }

            // Update visuals
            const pk = CHARACTER_DATA[p.starterKey];
            p.gfx.setPosition(p.x, p.y);
            const newDir = SpriteFactory.getDir(p.dir.x, p.dir.y);
            if (newDir !== p.currentDir) { p.currentDir = newDir; p.gfx.setTexture(`starter_${p.starterKey}_${newDir}`); }
            const ePL = p.pl + p.superPL;
            const playerScale = Math.min(0.8, 0.35 + ePL * 0.002) * p.scaleMult;
            p.gfx.setScale(playerScale);
            p.plText.setPosition(p.x, p.y + 30 * playerScale * 2).setText(ePL.toString());
            p.shield.setPosition(p.x, p.y);
            p.glow.setPosition(p.x, p.y);
            p.shadow.setPosition(p.x + SHADOW_OX, p.y + SHADOW_OY).setScale(playerScale * 1.2, playerScale * 0.5);
            p.pnLabel.setPosition(p.x, p.y - 35 * playerScale * 2);

            // Ghost visual
            if (p.ghost) {
                p.gfx.setAlpha(0.3);
                p.pnLabel.setAlpha(0.3);
                p.glow.setFillStyle(0x888888, 0.05);
            } else if (p.superActive) {
                p.glow.setFillStyle(0xFFD700, 0.2 + Math.sin(Date.now() * 0.008) * 0.1);
            } else if (p.shielded) {
                p.glow.setFillStyle(0x00FFFF, 0.15);
            } else {
                p.glow.setFillStyle(pk.colour, 0.08);
            }

            // Trail VFX
            p.vfx.updateTrail(p.x, p.y, pk.colour, p.starterKey, p.currentDir);

            // Timers
            if (p.superActive) { p.superTimer -= delta; if (p.superTimer <= 0) { p.superActive = false; p.superPL = 0; p.gfx.clearTint(); } }
            if (p.shielded) { p.shieldTimer -= delta; p.shield.setStrokeStyle(3, 0x00ffff, 0.6).setFillStyle(0x00ffff, 0.1); if (p.shieldTimer <= 0) { p.shielded = false; p.shield.setStrokeStyle(3, 0x00ffff, 0).setFillStyle(0x00ffff, 0); if (!p.superActive) { p.superPL = 0; p.gfx.clearTint(); } } }
            if (p.speedBoosted) { p.speedTimer -= delta; if (p.speedTimer <= 0) p.speedBoosted = false; }
            if (!p.superActive) p.aura = Math.min(p.auraMax, p.aura + this.auraRegenRate * dt);
            if (p.iFrames > 0) { p.iFrames -= delta; if (!p.ghost) p.gfx.setAlpha(Math.sin(time * 0.02) > 0 ? 1 : 0.3); } else if (!p.ghost) { p.gfx.setAlpha(1); p.pnLabel.setAlpha(1); }

            // Ghost revive timer
            if (p.ghost) {
                p.ghostTimer -= delta;
                if (p.ghostTimer <= 0) {
                    p.ghost = false;
                    p.hp = 30;
                    p.gfx.setAlpha(1);
                    p.pnLabel.setAlpha(1);
                    p.iFrames = 1500; // Brief invulnerability on revive
                    this.sharedVfx.burstParticles(p.x, p.y, CHARACTER_DATA[p.starterKey].colour, 8, 100, 400);
                    this.floatText(p.x, p.y, 'REVIVED!', p.playerNum === 1 ? '#44ff44' : '#00ccff');
                }
            }
        });

        // Shared VFX
        this.sharedVfx.updateEffects(dt);

        // Camera midpoint + dynamic zoom
        this.midpoint.setPosition((this.p1.x + this.p2.x) / 2, (this.p1.y + this.p2.y) / 2);
        const dist = Phaser.Math.Distance.Between(this.p1.x, this.p1.y, this.p2.x, this.p2.y);
        const targetZoom = this.phase === 'duel' ? Phaser.Math.Clamp(1.0 - (dist - 300) * 0.001, 0.55, 0.95) : Phaser.Math.Clamp(1.0 - (dist - 300) * 0.001, 0.6, 1.0);
        const curZoom = this.cameras.main.zoom;
        this.cameras.main.setZoom(curZoom + (targetZoom - curZoom) * 0.05);

        // Move enemies
        const maxPlayerPL = Math.max(this.p1.pl + this.p1.superPL, this.p2.pl + this.p2.superPL);
        this.enemies.forEach(e => {
            // Process burn timer
            if (e.burnTimer > 0) {
                e.burnTimer -= delta;
                const burnThisTick = e.burnDmg * dt;
                e.pl = Math.max(1, Math.floor(e.pl - burnThisTick));
                e.text.setText(e.isBoss ? e.pl.toString() : (e.isElite ? '💀' : e.pl.toString()));
                if (e.burnTimer <= 0) {
                    e.burnTimer = 0;
                    e.burnDmg = 0;
                    if (!e.isElite) e.gfx.clearTint();
                }
            }
            // Process slow timer
            if (e.slowTimer > 0) {
                e.slowTimer -= delta;
                if (e.slowTimer <= 0) { e.slowTimer = 0; e.slowFactor = 1; }
            }
            // Process stun timer
            if (e.stunTimer > 0) {
                e.stunTimer -= delta;
                if (e.stunTimer <= 0) { e.stunTimer = 0; }
            }

            // Movement (stunned = no movement, slowed = reduced speed)
            const isStunned = e.stunTimer > 0;
            const speedMult = isStunned ? 0 : (e.slowFactor !== undefined ? e.slowFactor : 1);

            if (e.isBoss && this.phase === 'duel') {
                // Boss chases CLOSER player
                const d1 = Phaser.Math.Distance.Between(this.p1.x, this.p1.y, e.x, e.y);
                const d2 = Phaser.Math.Distance.Between(this.p2.x, this.p2.y, e.x, e.y);
                const target = (d1 <= d2 && !this.p1.ghost) || this.p2.ghost ? this.p1 : this.p2;
                const ddx = target.x - e.x, ddy = target.y - e.y, ddist = Math.sqrt(ddx * ddx + ddy * ddy);
                if (ddist > 5) { e.dir.x = ddx / ddist; e.dir.y = ddy / ddist; }
                e.x += e.dir.x * (e.speed + 40) * speedMult * dt; e.y += e.dir.y * (e.speed + 40) * speedMult * dt;
            } else {
                if (Math.random() < 0.005) { const a = Phaser.Math.Angle.Random(); e.dir.x = Math.cos(a); e.dir.y = Math.sin(a); }
                e.x += e.dir.x * e.speed * speedMult * dt; e.y += e.dir.y * e.speed * speedMult * dt;
            }
            if (e.x < this.arenaLeft + e.radius || e.x > this.arenaRight - e.radius) { e.dir.x *= -1; e.x = Phaser.Math.Clamp(e.x, this.arenaLeft + e.radius, this.arenaRight - e.radius); }
            if (e.y < this.arenaTop + e.radius || e.y > this.arenaBottom - e.radius) { e.dir.y *= -1; e.y = Phaser.Math.Clamp(e.y, this.arenaTop + e.radius, this.arenaBottom - e.radius); }
            for (const o of this.obstacles) { const odx = e.x - o.x, ody = e.y - o.y, hW = o.w / 2 + e.radius, hH = o.h / 2 + e.radius; if (Math.abs(odx) < hW && Math.abs(ody) < hH) { const ovX = hW - Math.abs(odx), ovY = hH - Math.abs(ody); if (ovX < ovY) { e.dir.x *= -1; e.x += (odx > 0 ? ovX : -ovX); } else { e.dir.y *= -1; e.y += (ody > 0 ? ovY : -ovY); } } }
            e.gfx.setPosition(e.x, e.y); e.text.setPosition(e.x, e.y + e.radius + 10);
            if (e.ring) e.ring.setPosition(e.x, e.y);
            if (e.shadow) e.shadow.setPosition(e.x + SHADOW_OX, e.y + SHADOW_OY);
            if (e.creatureType) { const nd = SpriteFactory.getDir(e.dir.x, e.dir.y); if (nd !== e.currentDir) { e.currentDir = nd; e.gfx.setTexture((e.isBoss ? `enemy_${e.creatureType}_boss_` : `enemy_${e.creatureType}_`) + nd); } }
            e.gfx.setAngle(Math.atan2(e.dir.y, e.dir.x) * 180 / Math.PI * 0.08);
            if (e.ring && !e.isBoss) e.ring.setFillStyle(maxPlayerPL > e.pl ? 0x44ff44 : 0xff4444, 0.12);
        });

        // Collision: each player vs enemies
        this.players.forEach(p => {
            if (p.ghost) return; // Ghosts can't collide
            const playerPL = p.pl + p.superPL;
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                const ddx = p.x - e.x, ddy = p.y - e.y, ddist = Math.sqrt(ddx * ddx + ddy * ddy);
                const hitDist = e.isBoss ? 72 : 32 + e.radius;
                if (ddist < hitDist) {
                    if (playerPL > e.pl || p.shielded) {
                        const absorbed = Math.floor(e.pl * 0.5); p.pl += absorbed; this.score += e.pl;
                        p.combo++; if (p.combo > p.maxCombo) p.maxCombo = p.combo;
                        const comboBonus = Math.floor(absorbed * (p.combo * 0.1)); p.pl += comboBonus;
                        if (p.combo >= 2) { const cl = p.combo >= 10 ? `x${p.combo} MEGA!!!` : p.combo >= 5 ? `x${p.combo} COMBO!!` : `x${p.combo}!`; this.floatText(e.x, e.y - 30, cl, p.combo >= 10 ? '#FFD700' : p.combo >= 5 ? '#FF6600' : '#44FF44'); }
                        p.vfx._rainbowTrail = p.combo >= 5;
                        if (p.combo >= 10) this.cameras.main.flash(100, 255, 215, 0);
                        this.floatText(e.x, e.y, `+${absorbed + comboBonus}`);
                        this.sharedVfx.shockwave(e.x, e.y, 0xffffff);
                        this.sharedVfx.burstParticles(e.x, e.y, e.colour, 6, 100, 300);
                        this.audio.sfxEat();
                        if (e.isBoss && this.phase === 'duel') { this.duelWon(e); return; }
                        this.destroyEnemy(e, i);
                    } else if (p.iFrames <= 0) {
                        const dmg = Math.max(5, Math.floor((e.pl - playerPL) * 0.3)); p.hp -= dmg;
                        p.iFrames = 600; p.combo = 0; p.vfx._rainbowTrail = false;
                        this.cameras.main.shake(120 + dmg * 4, 0.004 + dmg * 0.001);
                        this.floatText(p.x, p.y, `-${dmg}`, '#ff4444');
                        this.audio.sfxDamage();
                        const angle = Math.atan2(ddy, ddx); p.x += Math.cos(angle) * 60; p.y += Math.sin(angle) * 60;
                        if (p.hp <= 0) {
                            // Ghost system
                            p.ghost = true;
                            p.ghostTimer = 5000;
                            p.hp = 0;
                            p.gfx.setAlpha(0.3);
                            p.pnLabel.setAlpha(0.3);
                            this.floatText(p.x, p.y, 'DOWN!', '#ff0000');
                            // Check if BOTH ghosts = game over
                            if (this.p1.ghost && this.p2.ghost) { this.gameOver('defeated'); return; }
                        }
                    }
                }
            }
        });

        // Collision: power-ups (first player to touch gets it)
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const pu = this.powerUps[i];
            let claimed = false;
            for (const p of this.players) {
                if (p.ghost) continue;
                const ddx = p.x - pu.x, ddy = p.y - pu.y;
                if (Math.sqrt(ddx * ddx + ddy * ddy) < 52) {
                    if (pu.type.effect === 'pl') p.pl += pu.type.value;
                    else if (pu.type.effect === 'shield') { p.shielded = true; p.shieldTimer = pu.type.value; }
                    else if (pu.type.effect === 'speed') { p.speedBoosted = true; p.speedTimer = pu.type.value; }
                    this.floatText(pu.x, pu.y, `${pu.type.emoji} ${pu.type.name}`, '#ffffff');
                    this.sharedVfx.burstParticles(pu.x, pu.y, pu.type.colour, 6, 80, 400);
                    this.audio.sfxPowerUp();
                    pu.gfx.destroy(); pu.text.destroy(); if (pu.glow) pu.glow.destroy(); if (pu.shadow) pu.shadow.destroy();
                    this.powerUps.splice(i, 1);
                    claimed = true;
                    break;
                }
            }
            if (claimed) continue;
        }

        // Spawn power-ups
        this.powerUpTimer += dt;
        if (this.powerUpTimer > 3 && this.powerUps.length < 8 && this.phase === 'arena') { this.spawnPowerUp(); this.powerUpTimer = 0; }

        // Level timer
        this.levelTime -= dt; if (this.levelTime < 0) this.levelTime = 0;
        if (this.phase === 'arena' && this.levelTime <= 15) {
            this.phase = 'countdown';
            this.warningText.setText('FINAL SHOWDOWN\nAPPROACHING!').setAlpha(1);
            this.tweens.add({ targets: this.warningText, alpha: 0, duration: 2000, yoyo: true, repeat: 2 });
            this.cameras.main.setZoom(0.85);
            this.audio.transitionToCountdown();
        }
        if (this.phase === 'countdown' && this.levelTime <= 10) this.startDuel();
        if (this.phase === 'duel' && this.levelTime <= 0) {
            if (this.boss) {
                const combinedPL = (this.p1.pl + this.p1.superPL) + (this.p2.pl + this.p2.superPL);
                if (combinedPL >= this.boss.pl) this.duelWon(this.boss);
                else this.gameOver('timeout');
            }
            return;
        }

        // Respawn
        if (this.phase === 'arena') {
            const lvlCfg = this.getLevelConfig(Math.min(this.currentLevel - 1, LEVEL_CONFIGS.length - 1));
            if (this.enemies.length < Math.floor(lvlCfg.enemyCount * 0.6)) this.spawnEnemy(lvlCfg);
        }
        if (this.boss && this.boss.superCooldown !== undefined) { this.boss.superCooldown -= dt; if (this.boss.superCooldown <= 0) { this.boss.pl += Math.floor(this.boss.pl * 0.12); this.boss.superCooldown = 8; this.floatText(this.boss.x, this.boss.y, 'POWER UP!', '#ff00ff'); } }

        this.updateHUD();
        this.updateMinimap();
    }

    destroyEnemy(e, idx) {
        e.gfx.destroy(); e.text.destroy();
        if (e.ring) e.ring.destroy(); if (e.shadow) e.shadow.destroy(); if (e.bossGlow) e.bossGlow.destroy();
        this.enemies.splice(idx, 1);
    }

    startDuel() {
        if (this.phase === 'duel') return; this.phase = 'duel';
        this.enemies.forEach(e => this.destroyEnemy(e, 0)); this.enemies = [];
        this.powerUps.forEach(p => { p.gfx.destroy(); p.text.destroy(); if (p.glow) p.glow.destroy(); if (p.shadow) p.shadow.destroy(); }); this.powerUps = [];
        this.obstacles.forEach(o => { o.gfx.destroy(); o.label.destroy(); if (o.shadow) o.shadow.destroy(); }); this.obstacles = [];

        // Shrink arena around midpoint of both players
        const midX = (this.p1.x + this.p2.x) / 2;
        const midY = (this.p1.y + this.p2.y) / 2;
        const duelSize = 800;
        this.arenaLeft = midX - duelSize / 2; this.arenaTop = midY - duelSize / 2;
        this.arenaRight = midX + duelSize / 2; this.arenaBottom = midY + duelSize / 2;
        this.arenaLeft = Math.max(100, this.arenaLeft); this.arenaTop = Math.max(100, this.arenaTop);
        this.arenaRight = Math.min(WORLD_W - 100, this.arenaRight); this.arenaBottom = Math.min(WORLD_H - 100, this.arenaBottom);
        this.arenaW = this.arenaRight - this.arenaLeft; this.arenaH = this.arenaBottom - this.arenaTop;

        // Duel border
        const duelBorder = this.add.rectangle(this.arenaLeft + this.arenaW / 2, this.arenaTop + this.arenaH / 2, this.arenaW, this.arenaH).setFillStyle(0x000000, 0).setStrokeStyle(4, 0xff2222, 0.9).setDepth(2);
        this.tweens.add({ targets: duelBorder, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });

        this.cameras.main.setZoom(0.95);
        this.audio.transitionToDuel(); this.audio.sfxBossEntrance();

        // Boss — PL based on combined average
        const lvlIdx = Math.min(this.currentLevel - 1, LEVEL_CONFIGS.length - 1);
        const lvlCfg = this.getLevelConfig(lvlIdx);
        const combinedPL = this.p1.pl + this.p2.pl;
        const bossPL = Math.floor(combinedPL * 0.5 * lvlCfg.bossMulti);
        const bossIdx = Math.min(this.currentLevel - 1, BOSS_NAMES.length - 1);
        const bossColour = BOSS_COLOURS[bossIdx];
        const bossHue = (bossIdx * 60) % 360;
        const bossCreatureType = SpriteFactory.getEnemyType(bossHue);
        const bx = this.arenaLeft + this.arenaW / 2, byTarget = this.arenaTop + 120, byStart = this.arenaTop - 100;

        const bossGlow = this.add.circle(bx, byStart, 60, bossColour, 0.15).setDepth(9);
        this.tweens.add({ targets: bossGlow, alpha: 0.05, duration: 600, yoyo: true, repeat: -1 });
        const bossShadow = this.add.ellipse(bx + SHADOW_OX, byStart + SHADOW_OY, 80, 30, 0x000000, 0.25).setDepth(3);
        const bossGfx = this.add.image(bx, byStart, `enemy_${bossCreatureType}_boss_S`).setScale(0.9).setDepth(10);
        const bossText = this.add.text(bx, byStart + 50, bossPL.toString(), { fontSize: `${11 * S}px`, color: '#fff', fontFamily: 'Arial Black', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(11);

        this.boss = { x: bx, y: byStart, pl: bossPL, colour: bossColour, name: BOSS_NAMES[bossIdx], speed: 100 + this.currentLevel * 16, radius: 22 * S, dir: { x: 0, y: 1 }, gfx: bossGfx, text: bossText, isBoss: true, ring: null, shadow: bossShadow, bossGlow, creatureType: bossCreatureType, currentDir: 'S', burnTimer: 0, burnDmg: 0, slowTimer: 0, slowFactor: 1, stunTimer: 0 };
        if (lvlCfg.bossSuper) this.boss.superCooldown = 5;

        const darkOverlay = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0).setDepth(180).setScrollFactor(0);
        this.tweens.add({ targets: darkOverlay, alpha: 0.4, duration: 300, yoyo: true, hold: 400, onComplete: () => darkOverlay.destroy() });
        this.tweens.add({ targets: [bossGfx, bossText, bossGlow, bossShadow], y: `+=${byTarget - byStart}`, duration: 800, ease: 'Bounce.easeOut', onComplete: () => { this.boss.y = byTarget; this.enemies.push(this.boss); } });

        const vsText = this.add.text(GAME_W / 2, GAME_H / 2, `VS ${BOSS_NAMES[bossIdx]}!`, { fontSize: `${30 * S}px`, color: '#FF4444', fontFamily: 'Arial Black', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(200).setScale(0.5).setScrollFactor(0);
        this.tweens.add({ targets: vsText, scale: 1.2, duration: 400, ease: 'Back.easeOut' });
        this.tweens.add({ targets: vsText, alpha: 0, delay: 1200, duration: 400, onComplete: () => vsText.destroy() });

        [this.duelBarBg, this.duelBarPlayer, this.duelBarBoss, this.duelTextPlayer, this.duelTextBoss].forEach(o => o.setVisible(true));
    }

    duelWon(boss) {
        this.sharedVfx.burstParticles(boss.x, boss.y, 0xFFD700, 20, 200, 800);
        this.cameras.main.flash(300, 255, 255, 255);
        this.audio.sfxBossDefeat();
        this.destroyEnemy(boss, this.enemies.indexOf(boss));
        const duelTime = 10 - Math.max(0, this.levelTime);
        this.time.delayedCall(500, () => {
            this.scene.start('LevelComplete', {
                starter1: this.starter1Key, starter2: this.starter2Key,
                level: this.currentLevel,
                finalPL: this.p1.pl + this.p2.pl,
                score: this.score,
                duelTime: Math.round(duelTime),
                bossName: boss.name,
                upgrades: this.playerUpgrades
            });
        });
    }

    gameOver(reason) {
        this.audio.sfxGameOver();
        this.time.delayedCall(400, () => {
            this.scene.start('GameOver', {
                starter1: this.starter1Key, starter2: this.starter2Key,
                level: this.currentLevel,
                finalPL: (this.p1.pl + this.p1.superPL) + (this.p2.pl + this.p2.superPL),
                score: this.score,
                reason
            });
        });
    }

    updateHUD() {
        const barW = 180;
        // P1
        const ePL1 = this.p1.pl + this.p1.superPL;
        this.hud1.pl.setText(`PL: ${ePL1}`);
        const hp1Pct = Math.max(0, this.p1.hp / 100);
        this.hud1.hpBar.setSize(barW * hp1Pct, 12).setFillStyle(this.p1.ghost ? 0x555555 : hp1Pct > 0.5 ? 0x44ff44 : hp1Pct > 0.25 ? 0xffaa00 : 0xff4444);
        const aura1Pct = Math.max(0, this.p1.aura / this.p1.auraMax);
        this.hud1.auraBar.setSize(barW * aura1Pct, 12).setFillStyle(this.p1.aura >= 30 ? 0x4488ff : 0x884444);

        // P2
        const ePL2 = this.p2.pl + this.p2.superPL;
        this.hud2.pl.setText(`PL: ${ePL2}`);
        const hp2Pct = Math.max(0, this.p2.hp / 100);
        this.hud2.hpBar.setSize(barW * hp2Pct, 12).setFillStyle(this.p2.ghost ? 0x555555 : hp2Pct > 0.5 ? 0x44ff44 : hp2Pct > 0.25 ? 0xffaa00 : 0xff4444);
        const aura2Pct = Math.max(0, this.p2.aura / this.p2.auraMax);
        this.hud2.auraBar.setSize(barW * aura2Pct, 12).setFillStyle(this.p2.aura >= 30 ? 0x4488ff : 0x884444);

        // Centre
        this.hudTimer.setText(Math.ceil(this.levelTime).toString()).setColor(this.levelTime <= 10 ? '#FF4444' : '#ffffff');
        this.hudScore.setText(`Score: ${this.score}`);

        // Duel bar — combined P1+P2 vs Boss
        if (this.phase === 'duel' && this.boss) {
            const combinedPL = ePL1 + ePL2;
            const totalPL = combinedPL + this.boss.pl;
            const pPct = combinedPL / totalPL;
            this.duelBarPlayer.setSize(600 * pPct, 26).setPosition(GAME_W / 2 - 300 + 600 * pPct / 2, 90);
            this.duelBarBoss.setSize(600 * (1 - pPct), 26).setPosition(GAME_W / 2 - 300 + 600 * pPct + 600 * (1 - pPct) / 2, 90);
            this.duelTextPlayer.setText(`TEAM ${combinedPL}`); this.duelTextBoss.setText(`${this.boss.name} ${this.boss.pl}`);
        }

        // SP button alpha
        this.sp1Button.setAlpha(this.p1.aura >= 30 && !this.p1.ghost ? 0.5 : 0.15);
        this.sp2Button.setAlpha(this.p2.aura >= 30 && !this.p2.ghost ? 0.5 : 0.15);
    }
}

// ============================================================
// LEVEL COMPLETE — 2 Player
// ============================================================
class LevelCompleteScene extends Phaser.Scene {
    constructor() { super('LevelComplete'); }
    init(data) { this.d = data; }
    create() {
        const d = this.d, cx = GAME_W / 2;
        const pk1 = CHARACTER_DATA[d.starter1], pk2 = CHARACTER_DATA[d.starter2];
        this.add.rectangle(cx, GAME_H / 2, GAME_W, GAME_H, 0x0a0a1e);
        this.add.text(cx, 60, '⭐ LEVEL COMPLETE ⭐', { fontSize: `${26 * S}px`, color: '#FFD700', fontFamily: 'Arial Black', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
        this.add.text(cx, 100, `Level ${d.level}`, { fontSize: `${18 * S}px`, color: '#fff' }).setOrigin(0.5);
        [
            `P1: ${pk1.name}  |  P2: ${pk2.name}`,
            `Combined PL: ${d.finalPL}`,
            `Boss ${d.bossName} defeated in ${d.duelTime}s`,
            `Score: ${d.score}`
        ].forEach((s, i) => {
            this.add.text(cx, 140 + i * 26 * S, s, { fontSize: `${12 * S}px`, color: '#ccc', align: 'center' }).setOrigin(0.5);
        });
        this.add.text(cx, 310, 'CHOOSE YOUR UPGRADE', { fontSize: `${18 * S}px`, color: '#FFD700', fontFamily: 'Arial Black' }).setOrigin(0.5);
        this.add.text(cx, 338, '(Applies to both players)', { fontSize: `${10 * S}px`, color: '#888' }).setOrigin(0.5);
        [
            { key: 'pl', label: '🌀 Level Up!', desc: '+20 Base PL (both)', y: 380 },
            { key: 'aura', label: '🔵 Extra Aura', desc: '+30 Max Aura (both)', y: 430 },
            { key: 'speed', label: '💨 Speed Upgrade', desc: '+20 Base Speed (both)', y: 480 }
        ].forEach(u => {
            const btn = this.add.rectangle(cx, u.y, 560, 55, 0x1a1a3e).setStrokeStyle(2, 0x4444aa).setInteractive({ useHandCursor: true });
            this.add.text(cx, u.y - 8, u.label, { fontSize: `${14 * S}px`, color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
            this.add.text(cx, u.y + 14, u.desc, { fontSize: `${10 * S}px`, color: '#888' }).setOrigin(0.5);
            btn.on('pointerover', () => btn.setStrokeStyle(2, 0xFFD700));
            btn.on('pointerout', () => btn.setStrokeStyle(2, 0x4444aa));
            btn.on('pointerdown', () => {
                this.scene.start('Game', {
                    starter1: d.starter1, starter2: d.starter2,
                    level: d.level + 1,
                    carryPL: Math.floor(d.finalPL * 0.15),
                    upgrades: [...(d.upgrades || []), u.key]
                });
            });
        });
    }
}

// ============================================================
// GAME OVER — 2 Player
// ============================================================
class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOver'); }
    init(data) { this.d = data; }
    create() {
        const d = this.d, cx = GAME_W / 2;
        const pk1 = CHARACTER_DATA[d.starter1], pk2 = CHARACTER_DATA[d.starter2];
        this.add.rectangle(cx, GAME_H / 2, GAME_W, GAME_H, 0x0a0a1e);
        this.add.text(cx, 120, 'GAME OVER', { fontSize: `${36 * S}px`, color: '#FF4444', fontFamily: 'Arial Black', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5);
        this.add.text(cx, 170, d.reason === 'timeout' ? 'Time ran out — Boss survived!' : 'Both players down!', { fontSize: `${15 * S}px`, color: '#ff8888' }).setOrigin(0.5);
        this.add.text(cx, 210, `Level: ${d.level}  |  PL: ${d.finalPL}  |  Score: ${d.score}`, { fontSize: `${14 * S}px`, color: '#ccc' }).setOrigin(0.5);
        this.add.text(cx, 240, `${pk1.name} + ${pk2.name}`, { fontSize: `${13 * S}px`, color: '#aaa' }).setOrigin(0.5);
        const retryBtn = this.add.rectangle(cx, 320, 440, 70, 0x225522).setStrokeStyle(2, 0x44aa44).setInteractive({ useHandCursor: true });
        this.add.text(cx, 320, 'RETRY LEVEL', { fontSize: `${16 * S}px`, color: '#44ff44', fontFamily: 'Arial Black' }).setOrigin(0.5);
        retryBtn.on('pointerdown', () => this.scene.start('Game', { starter1: d.starter1, starter2: d.starter2, level: d.level, carryPL: 0, upgrades: [] }));
        const menuBtn = this.add.rectangle(cx, 400, 440, 70, 0x333355).setStrokeStyle(2, 0x6666aa).setInteractive({ useHandCursor: true });
        this.add.text(cx, 400, 'MAIN MENU', { fontSize: `${16 * S}px`, color: '#8888ff', fontFamily: 'Arial Black' }).setOrigin(0.5);
        menuBtn.on('pointerdown', () => this.scene.start('Menu'));
    }
}

// ============================================================
// CONFIG
// ============================================================
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: GAME_W,
    height: GAME_H,
    backgroundColor: '#0a0a1e',
    pauseOnBlur: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [MenuScene, GameScene, LevelCompleteScene, GameOverScene],
};
const game = new Phaser.Game(config);
