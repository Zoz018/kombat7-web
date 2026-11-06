import Phaser from 'phaser';
import { W, H, FLOOR, FONT, ROSTER, MAX_HP, ROUND_TIME, ROUNDS_TO_WIN } from '../config.js';
import { Controls } from '../controls.js';
import { Fighter } from '../fighter.js';
import { Puppet } from '../anim.js';

const overlap = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

export class Fight extends Phaser.Scene {
  constructor() { super('Fight'); }

  init(data) { this.sel = data; }

  create() {
    this.cameras.main.fadeIn(200, 0, 0, 0);
    this.drawStage();
    this.controls = [new Controls(this, 0), new Controls(this, 1)];
    this.f = [
      new Fighter(this, this.sel.p1, 0, this.controls[0], 330),
      new Fighter(this, this.sel.p2, 1, this.controls[1], W - 330),
    ];
    this.wins = [0, 0];
    this.round = 1;
    this.hitstop = 0;
    this.buildHud();
    this.startRound();
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Select'));
  }

  // --- décor (en attendant un vrai stage dessiné) -------------------------------------------------
  drawStage() {
    const g = this.add.graphics().setDepth(-10);
    g.fillGradientStyle(0x1d2b53, 0x1d2b53, 0xe58a5c, 0xe58a5c, 1);
    g.fillRect(0, 0, W, FLOOR);
    g.fillStyle(0xffd27a, 1).fillCircle(760, 250, 70);
    g.fillStyle(0xffe6a8, 1).fillCircle(760, 250, 52);
    // skyline
    g.fillStyle(0x3a3355, 1);
    const rnd = new Phaser.Math.RandomDataGenerator(['kombat7']);
    for (let x = 0; x < W; x += 46) {
      const h = 60 + rnd.between(0, 120);
      g.fillRect(x, FLOOR - h, 42, h);
    }
    g.fillStyle(0x2a2540, 1);
    for (let x = 20; x < W; x += 70) {
      const h = 40 + rnd.between(0, 90);
      g.fillRect(x, FLOOR - h, 56, h);
    }
    // sol
    g.fillGradientStyle(0x6a5b72, 0x6a5b72, 0x2b2336, 0x2b2336, 1);
    g.fillRect(0, FLOOR, W, H - FLOOR);
    g.lineStyle(2, 0x000000, 0.35);
    g.lineBetween(0, FLOOR, W, FLOOR);
    for (let x = -200; x < W + 200; x += 80) g.lineBetween(x + (x - 512) * 0.25, H, x, FLOOR);
    g.lineStyle(2, 0x000000, 0.25);
    g.lineBetween(0, FLOOR + 26, W, FLOOR + 26);
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
      fontFamily: FONT, fontSize: '72px', color: '#ffe35a', stroke: '#000', strokeThickness: 12, fontStyle: 'bold', align: 'center',
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
      this.pips[i].forEach((c, k) => c.setFillStyle(k < this.wins[i] ? 0xffe35a : 0x222222));
    }
    this.timerText.setText(String(Math.max(0, Math.ceil(this.timeLeft ?? ROUND_TIME))));
  }

  announce(text, sub = '', color = '#ffe35a') {
    this.banner.setText(text).setColor(color).setVisible(true).setScale(0.3).setAlpha(1);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.sub.setText(sub).setVisible(!!sub);
  }

  hideBanner() { this.banner.setVisible(false); this.sub.setVisible(false); }

  // --- manches ---------------------------------------------------------------------------------
  startRound() {
    this.f[0].reset(330, 1);
    this.f[1].reset(W - 330, -1);
    this.timeLeft = ROUND_TIME;
    this.phase = 'intro';
    this.phaseT = 0;
    this.slowmo = 1;
    this.announce(`MANCHE ${this.round}`);
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
    this.updateHud();
  }

  matchOver() {
    this.phase = 'over';
    this.phaseT = 0;
    const w = this.wins[0] > this.wins[1] ? 0 : 1;
    const name = [this.sel.p1, this.sel.p2][w];
    this.announce(`${ROSTER[name].label} GAGNE !`, `J${w + 1}    ·    Poing : rejouer    ·    Spécial : choisir d'autres persos`);
    this.f[w].win();
    this.puppet = null;
  }

  // --- boucle ----------------------------------------------------------------------------------
  update(_, delta) {
    for (const c of this.controls) c.poll();
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
      if (this.phaseT > 1000 && this.banner.text !== 'FIGHT !') this.announce('FIGHT !', '', '#ff5a4a');
      if (this.phaseT > 1700) { this.hideBanner(); this.phase = 'fight'; }
    }

    this.f[0].update(dt, this.f[1], canAct);
    this.f[1].update(dt, this.f[0], canAct);
    this.separate();
    if (canAct) this.resolveHits();
    this.f.forEach((f) => f.render());

    if (this.phase === 'fight') {
      this.timeLeft -= dt / 1000;
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
