import { NEUTRAL } from './controls.js';

const ACTIONS = ['left', 'right', 'up', 'down', 'jab', 'special', 'start'];

// Adversaire contrôlé par l'ordinateur : même interface que Controls (held / pressed / poll),
// mais les "touches" sont décidées toutes les ~150-300 ms (temps de réaction) à partir de la situation.
export class AIControls {
  constructor(scene) {
    this.scene = scene;
    this.me = null;
    this.opp = null;
    this.held = { ...NEUTRAL.held };
    this.pressed = { ...NEUTRAL.pressed };
    this.think = 0;
    this.moveDir = 0; // -1 gauche, 1 droite, 0 rien
    this.guard = 0;   // ms restantes à garder la garde
    this.want = null; // 'jab' | 'special' | 'up' à appuyer à la prochaine frame
  }

  setFighters(me, opp) { this.me = me; this.opp = opp; }

  decide() {
    const { me, opp } = this;
    const dx = opp.x - me.x;
    const d = Math.abs(dx);
    const toward = Math.sign(dx) || me.face;
    const r = Math.random();
    this.think = 150 + Math.random() * 150;
    this.moveDir = 0;

    // garde si l'adversaire attaque de près
    if ((opp.state === 'jab' || opp.state === 'special') && d < 260 && Math.random() < 0.55) {
      this.guard = 350;
    }
    if (this.guard > 0) { this.moveDir = -toward; return; }

    if (me.state !== 'free') return;
    if (d > 300 && me.cd <= 0 && r < 0.3) { this.want = 'special'; return; }
    if (d > 125) { this.moveDir = toward; if (r < 0.06) this.want = 'up'; return; }
    // au contact
    if (r < 0.55) this.want = 'jab';
    else if (r < 0.7 && me.cd <= 0) this.want = 'special';
    else if (r < 0.85) this.moveDir = -toward; // petit recul
  }

  poll(dt = 16) {
    const now = {};
    for (const a of ACTIONS) now[a] = false;
    if (this.me && this.scene.phase === 'fight' && !this.scene.paused) {
      this.think -= dt;
      this.guard = Math.max(0, this.guard - dt);
      if (this.think <= 0) this.decide();
      if (this.moveDir < 0) now.left = true;
      if (this.moveDir > 0) now.right = true;
      if (this.guard > 0) { now.left = false; now.right = false; now[this.guardKey()] = true; }
      if (this.want) { now[this.want] = true; this.want = null; }
    }
    for (const a of ACTIONS) {
      this.pressed[a] = now[a] && !this.held[a];
      this.held[a] = now[a];
    }
  }

  guardKey() {
    // "en arrière" = direction opposée à l'adversaire
    return this.opp.x > this.me.x ? 'left' : 'right';
  }
}
