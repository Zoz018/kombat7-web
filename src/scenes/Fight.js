import Phaser from 'phaser';
import { W, H, FONT, ROSTER, MAX_HP, ROUND_TIME, ROUNDS_TO_WIN } from '../config.js';
import { Controls } from '../controls.js';
import { AIControls } from '../ai.js';
import { Fighter } from '../fighter.js';
import { Puppet } from '../anim.js';
import { music, sfx, setMusicVolume } from '../audio.js';

const PAUSE_ITEMS = [
  { id: 'resume', label: 'REPRENDRE' },
  { id: 'keys', label: 'TOUCHES' },
  { id: 'select', label: 'CHANGER DE PERSOS' },
  { id: 'menu', label: 'MENU PRINCIPAL' },
];

const overlap = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

export class Fight extends Phaser.Scene {
  constructor() { super('Fight'); }

  init(data) { this.sel = data; }

  create() {
    this.cameras.main.fadeIn(200, 0, 0, 0);
    this.drawStage();
    const vsAI = this.registry.get('mode') === 'ai';
    this.controls = [new Controls(this, 0), vsAI ? new AIControls(this) : new Controls(this, 1)];
    this.f = [
      new Fighter(this, this.sel.p1, 0, this.controls[0], 330),
      new Fighter(this, this.sel.p2, 1, this.controls[1], W - 330),
    ];
    if (vsAI) this.controls[1].setFighters(this.f[1], this.f[0]);
    this.wins = [0, 0];
    this.round = 1;
    this.hitstop = 0;
    this.lastTick = 99;
    music(this, 'music_fight', 0.4);
    this.buildHud();
    this.startRound();
    this.paused = false;
    this.leaving = false;
    this.buildPause();
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
  }

  // --- décor ---------------------------------------------------------------------------------
  drawStage() {
    // churros.png (683x455) agrandi pour couvrir l'écran, calé pour que le sol soit sous les pieds des combattants
    const bg = this.add.image(W / 2, 0, 'churros').setOrigin(0.5, 0).setDepth(-10);
    bg.setScale(Math.max(W / bg.width, H / bg.height));
    bg.y = Math.min(0, H - bg.displayHeight) * 0.65;
  }

  // --- HUD -------------------------------------------------------------------------------------
  buildHud() {
    const S = 4;
    this.bars = [];
    const names = [this.sel.p1, this.sel.p2];
    for (let i = 0; i < 2; i++) {
      const bx = i === 0 ? 70 : W - 70 - 64 * S;
      const back = this.add.image(bx, 2, 'life').setOrigin(0).setScale(S).setTint(0x2c2c2c).setDepth(20);
      const fill = this.add.image(bx, 2, 'life').setOrigin(0).setScale(S).setDepth(21);
      this.bars.push({ back, fill });
      const cx = i === 0 ? 14 : W - 14 - 48;
      this.add.rectangle(cx - 2, 8, 52, 52, 0x000000).setOrigin(0).setDepth(19);
      this.add.image(cx, 10, `card_${names[i]}`).setOrigin(0).setDepth(20);
      this.add.text(i === 0 ? bx + 8 : bx + 64 * S - 8, 62, ROSTER[names[i]].label, {
        fontFamily: FONT, fontSize: '16px', color: '#fff', stroke: '#000', strokeThickness: 4, fontStyle: 'bold',
      }).setOrigin(i === 0 ? 0 : 1, 0).setDepth(22);
    }
    this.timerText = this.add.text(W / 2, 30, '60', {
      fontFamily: FONT, fontSize: '44px', color: '#fff', stroke: '#000', strokeThickness: 8, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(22);
    this.pips = [[], []];
    for (let i = 0; i < 2; i++) {
      for (let k = 0; k < ROUNDS_TO_WIN; k++) {
        const x = W / 2 + (i === 0 ? -1 : 1) * (26 + k * 22);
        this.pips[i].push(this.add.circle(x, 72, 8, 0x222222).setStrokeStyle(3, 0x000000).setDepth(22));
      }
    }
    this.banner = this.add.text(W / 2, H / 2 - 40, '', {
      fontFamily: FONT, fontSize: '72px', color: '#ff0000', stroke: '#000', strokeThickness: 12, fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(40).setVisible(false);
    this.sub = this.add.text(W / 2, H / 2 + 40, '', {
      fontFamily: FONT, fontSize: '20px', color: '#ffffff', stroke: '#000', strokeThickness: 5, align: 'center',
    }).setOrigin(0.5).setDepth(40).setVisible(false);
    this.updateHud();
  }

  setBar(i, ratio) {
    const { fill } = this.bars[i];
    fill.setVisible(ratio > 0);
    if (ratio <= 0) return;
    const inner = 60;
    if (i === 0) fill.setCrop(0, 0, 2 + inner * ratio, 16);
    else {
      const x = Math.floor(62 - inner * ratio);
      fill.setCrop(x, 0, 64 - x, 16);
    }
    if (ratio < 0.3) fill.setTintFill(0xd9382c);
    else if (ratio < 0.55) fill.setTintFill(0xe8c21f);
    else fill.clearTint();
  }

  updateHud() {
    for (let i = 0; i < 2; i++) {
      this.setBar(i, this.f[i].hp / MAX_HP);
      this.pips[i].forEach((c, k) => c.setFillStyle(k < this.wins[i] ? 0xff0000 : 0x222222));
    }
    this.timerText.setText(String(Math.max(0, Math.ceil(this.timeLeft ?? ROUND_TIME))));
  }

  announce(text, sub = '', color = '#ff0000') {
    this.banner.setText(text).setColor(color).setVisible(true).setScale(0.3).setAlpha(1);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.sub.setText(sub).setVisible(!!sub);
  }

  hideBanner() { this.banner.setVisible(false); this.sub.setVisible(false); }

  // --- pause -----------------------------------------------------------------------------------
  buildPause() {
    // bouton "II" cliquable en bas à droite (touches : P ou Échap)
    const btn = this.add.container(W - 28, H - 28).setDepth(25);
    btn.add(this.add.circle(0, 0, 15, 0x000000, 0.65).setStrokeStyle(3, 0xffffff));
    btn.add(this.add.rectangle(-4, 0, 4, 14, 0xffffff));
    btn.add(this.add.rectangle(4, 0, 4, 14, 0xffffff));
    btn.setSize(34, 34).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.togglePause());

    const st = (size, color = '#ffffff') => ({ fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold' });
    const objs = [this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0)];
    objs.push(this.add.text(W / 2, 70, 'PAUSE', { ...st(52, '#ff0000'), stroke: '#000', strokeThickness: 8 }).setOrigin(0.5));
    this.pauseItems = PAUSE_ITEMS.map((it, i) => {
      const t = this.add.text(W / 2, 150 + i * 46, it.label, st(26)).setOrigin(0.5);
      t.setInteractive({ useHandCursor: true });
      t.on('pointerover', () => { this.pauseSel = i; this.refreshPause(); });
      t.on('pointerdown', () => { this.pauseSel = i; this.refreshPause(); this.pauseChoose(); });
      objs.push(t);
      return t;
    });
    this.keysPanel = this.add.container(0, 0, [
      this.add.rectangle(0, 0, W, H, 0x000000, 0.92).setOrigin(0),
      this.add.text(W / 2, 40, 'TOUCHES', { ...st(30, '#ff0000') }).setOrigin(0.5, 0),
      this.add.text(120, 100, ['JOUEUR 1', '', 'Déplacer   Q / D', 'Sauter     Z', 'Baisser    S', 'Poing (A)  F', 'Spécial (B) G', 'Bloquer    tenir la direction', '           opposée à l\'adversaire'].join('\n'),
        { fontFamily: FONT, fontSize: '16px', color: '#ff8a8a', lineSpacing: 6 }),
      this.add.text(W - 120, 100, ['JOUEUR 2', '', 'Déplacer   ← / →', 'Sauter     ↑', 'Baisser    ↓', 'Poing (A)  K (pavé num. 1)', 'Spécial (B) L (pavé num. 2)', 'Bloquer    idem'].join('\n'),
        { fontFamily: FONT, fontSize: '16px', color: '#9fb4ff', lineSpacing: 6 }).setOrigin(1, 0),
      this.add.text(W / 2, H - 50, 'Pause : P ou Échap  ·  Retour : spécial / Échap', { fontFamily: FONT, fontSize: '14px', color: '#cfd8dc' }).setOrigin(0.5),
    ]).setVisible(false);
    objs.push(this.keysPanel);
    this.pauseMenu = this.add.container(0, 0, objs).setDepth(60).setVisible(false);
    this.pauseSel = 0;
    this.refreshPause();
  }

  refreshPause() {
    this.pauseItems.forEach((t, i) => {
      t.setColor(i === this.pauseSel ? '#ff0000' : '#ffffff');
      t.setText((i === this.pauseSel ? '> ' : '  ') + PAUSE_ITEMS[i].label);
    });
  }

  togglePause() {
    if (this.leaving) return;
    if (this.paused && this.keysPanel.visible) { this.keysPanel.setVisible(false); return; }
    if (!this.paused && this.phase === 'over') return;
    this.paused = !this.paused;
    sfx(this, 'pause');
    this.pauseMenu.setVisible(this.paused);
    if (this.paused) { this.pauseSel = 0; this.refreshPause(); this.tweens.pauseAll(); this.time.paused = true; setMusicVolume(this, 0.15); }
    else { this.tweens.resumeAll(); this.time.paused = false; setMusicVolume(this, 0.4); }
  }

  pauseChoose() {
    const id = PAUSE_ITEMS[this.pauseSel].id;
    if (id === 'resume') return this.togglePause();
    if (id === 'keys') { this.keysPanel.setVisible(true); return undefined; }
    this.leaving = true;
    sfx(this, 'menu_ok');
    this.tweens.resumeAll();
    this.time.paused = false;
    if (id === 'select') this.scene.start('Select');
    else this.scene.start('Start');
    return undefined;
  }

  // --- manches ---------------------------------------------------------------------------------
  startRound() {
    this.f[0].reset(330, 1);
    this.f[1].reset(W - 330, -1);
    this.timeLeft = ROUND_TIME;
    this.phase = 'intro';
    this.phaseT = 0;
    this.slowmo = 1;
    this.announce(`MANCHE ${this.round}`);
    sfx(this, 'round');
    this.updateHud();
  }

  endRound(winner) {
    this.phase = 'ko';
    this.phaseT = 0;
    this.slowmo = 0.35;
    if (winner >= 0) this.wins[winner]++;
    this.winner = winner;
    const label = winner >= 0 ? '' : 'ÉGALITÉ';
    this.announce(winner >= 0 && this.f[winner === 0 ? 1 : 0].hp <= 0 ? 'K.O.' : (label || 'TEMPS !'), '', '#ff5a4a');
    if (this.banner.text === 'K.O.') sfx(this, 'ko', 0.9);
    this.updateHud();
  }

  matchOver() {
    this.phase = 'over';
    this.phaseT = 0;
    const w = this.wins[0] > this.wins[1] ? 0 : 1;
    const name = [this.sel.p1, this.sel.p2][w];
    this.announce(`${ROSTER[name].label} GAGNE !`, w === 1 && this.registry.get('mode') === 'ai' ? 'IA' : `J${w + 1}`);
    this.f[w].win();
    this.puppet = null;
    music(this, 'music_win', 0.5, false);
  }

  // --- boucle ----------------------------------------------------------------------------------
  update(_, delta) {
    for (const c of this.controls) c.poll(delta);
    if (this.paused) {
      const pr = (a) => this.controls.some((c) => c.pressed[a]);
      if (this.keysPanel.visible) {
        if (pr('special')) this.keysPanel.setVisible(false);
        return;
      }
      if (pr('up')) { this.pauseSel = (this.pauseSel + PAUSE_ITEMS.length - 1) % PAUSE_ITEMS.length; this.refreshPause(); sfx(this, 'menu_move'); }
      if (pr('down')) { this.pauseSel = (this.pauseSel + 1) % PAUSE_ITEMS.length; this.refreshPause(); sfx(this, 'menu_move'); }
      if (pr('jab') || pr('start')) this.pauseChoose();
      else if (pr('special')) this.togglePause();
      return;
    }
    if (this.controls.some((c) => c.pressed.start) && this.phase !== 'over') { this.togglePause(); return; }
    let dt = Math.min(delta, 33);

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.f.forEach((f) => f.render());
      return;
    }
    this.phaseT += dt;
    dt *= this.slowmo;

    const canAct = this.phase === 'fight';
    if (this.phase === 'intro') {
      if (this.phaseT > 1000 && this.banner.text !== 'FIGHT !') { this.announce('FIGHT !', '', '#ff5a4a'); sfx(this, 'fight', 0.8); }
      if (this.phaseT > 1700) { this.hideBanner(); this.phase = 'fight'; }
    }

    this.f[0].update(dt, this.f[1], canAct);
    this.f[1].update(dt, this.f[0], canAct);
    this.separate();
    if (canAct) this.resolveHits();
    this.f.forEach((f) => f.render());

    if (this.phase === 'fight') {
      this.timeLeft -= dt / 1000;
      const sec = Math.ceil(this.timeLeft);
      if (sec <= 5 && sec > 0 && sec < this.lastTick) { this.lastTick = sec; sfx(this, 'tick', 0.5); }
      if (this.f[0].hp <= 0 || this.f[1].hp <= 0) {
        const w = this.f[0].hp <= 0 && this.f[1].hp <= 0 ? -1 : this.f[0].hp <= 0 ? 1 : 0;
        if (w >= 0) this.f[w].win();
        this.endRound(w);
      } else if (this.timeLeft <= 0) {
        const a = this.f[0].hp, b = this.f[1].hp;
        const w = a === b ? -1 : a > b ? 0 : 1;
        if (w >= 0) this.f[w].win();
        this.endRound(w);
      }
    } else if (this.phase === 'ko') {
      if (this.phaseT > 900) this.slowmo = 1;
      if (this.phaseT > 2600) {
        this.hideBanner();
        if (this.wins[0] >= ROUNDS_TO_WIN || this.wins[1] >= ROUNDS_TO_WIN) this.matchOver();
        else { this.round++; this.startRound(); }
      }
    } else if (this.phase === 'over') {
      if (this.phaseT > 600) {
        if (this.controls.some((c) => c.pressed.jab || c.pressed.start)) {
          this.scene.restart(this.sel);
        } else if (this.controls.some((c) => c.pressed.special)) {
          this.scene.start('Select');
        }
      }
    }
    this.updateHud();
  }

  separate() {
    const [a, b] = this.f;
    if (a.state === 'ko' || b.state === 'ko') return;
    const dy = Math.abs(a.y - b.y);
    const min = 52;
    if (dy < a.meta.bodyH * 0.6) {
      const d = b.x - a.x;
      if (Math.abs(d) < min) {
        const push = (min - Math.abs(d)) / 2;
        const s = d === 0 ? (a.face || 1) : Math.sign(d);
        a.x -= s * push;
        b.x += s * push;
        a.x = Phaser.Math.Clamp(a.x, 40, W - 40);
        b.x = Phaser.Math.Clamp(b.x, 40, W - 40);
      }
    }
  }

  resolveHits() {
    for (let i = 0; i < 2; i++) {
      const atk = this.f[i];
      const def = this.f[1 - i];
      const box = atk.attackBox();
      if (!box || def.state === 'ko') continue;
      if (!overlap(box, def.hurtbox())) continue;
      atk.hitDone = true;
      const dir = Math.sign(def.x - atk.x) || atk.face;
      const spec = atk.state === 'special';
      const res = def.receiveHit(atk.atk, dir, atk.state);
      const hx = (Math.max(box.l, def.hurtbox().l) + Math.min(box.r, def.hurtbox().r)) / 2;
      const hy = def.y - def.meta.bodyH * 0.6;
      this.spark(hx, hy, res === 'block' ? 0x9fc4ff : spec ? 0xffa500 : 0xffffff);
      sfx(this, res === 'block' ? 'block' : spec ? 'hit_special' : 'hit', 0.8);
      if (res !== 'block') {
        this.hitstop = spec ? 90 : 55;
        this.cameras.main.shake(spec ? 160 : 90, spec ? 0.007 : 0.003);
      } else {
        this.hitstop = 30;
      }
    }
  }

  spark(x, y, color) {
    const c = this.add.circle(x, y, 8, color, 0.9).setDepth(30).setStrokeStyle(3, 0x000000);
    this.tweens.add({ targets: c, scale: 3.2, alpha: 0, duration: 220, onComplete: () => c.destroy() });
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI * 2 * k) / 6 + Math.random();
      const p = this.add.rectangle(x, y, 6, 6, color).setDepth(30);
      this.tweens.add({
        targets: p, x: x + Math.cos(a) * 46, y: y + Math.sin(a) * 46, alpha: 0, duration: 260,
        onComplete: () => p.destroy(),
      });
    }
  }
}
