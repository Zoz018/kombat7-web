import { FLOOR, ARENA_L, ARENA_R, MAX_HP, ROSTER } from './config.js';
import { frameAt, tagMs, flipFor } from './anim.js';
import { NEUTRAL } from './controls.js';

const GRAV = 2300;
const JUMP_V = 860;
const HALF_W = 27; // demi-largeur de la hurtbox
const JAB_BONUS = 22; // marge de portée : le poing dessiné + la hurtbox adverse laissent sinon une fenêtre trop étroite
const SPECIAL_BONUS = 50; // idem pour les spéciaux (les projectiles dessinés sont parfois courts)
const BUFFER_MS = 130;

export class Fighter {
  constructor(scene, name, side, controls, x) {
    this.scene = scene;
    this.name = name;
    this.side = side; // 0 = J1, 1 = J2
    this.controls = controls;
    this.meta = scene.registry.get('meta')[name];
    this.stats = ROSTER[name];

    // portée "au repos" (avant-bras en garde) pour ignorer les frames sans coup tendu
    const [ia, ib] = this.meta.tags.Idle;
    this.idleFwd = 0;
    for (let i = ia; i <= ib; i++) this.idleFwd = Math.max(this.idleFwd, this.fwd(i));

    this.shadow = scene.add.ellipse(x, FLOOR + 2, 74, 12, 0x000000, 0.35).setDepth(1);
    this.sprite = scene.add.sprite(x, FLOOR, `char_${name}`, 0)
      .setOrigin(0.5, this.meta.ay / this.meta.fh)
      .setDepth(5 + side);
    this.reset(x, side === 0 ? 1 : -1);
  }

  fwd(frame) {
    return this.meta.ext[frame][this.meta.faceRight ? 1 : 0];
  }

  reset(x, face) {
    this.x = x;
    this.y = FLOOR;
    this.vx = 0;
    this.vy = 0;
    this.face = face;
    this.hp = MAX_HP;
    this.state = 'free'; // free | jab | special | hit | block | ko | win
    this.tag = 'Idle';
    this.t = 0;
    this.loop = true;
    this.animSpeed = 1;
    this.atk = null;
    this.hitDone = false;
    this.stunT = 0;
    this.cd = 0;
    this.landT = 0;
    this.flash = 0;
    this.crouching = false;
    this.holdBack = false;
    this.buf = { jab: 0, special: 0 };
    this.sprite.setAngle(0).clearTint().setAlpha(1);
    this.render();
  }

  get grounded() { return this.y >= FLOOR; }

  play(tag, loop = true) {
    if (this.tag !== tag) {
      this.tag = tag;
      this.t = 0;
    }
    this.loop = loop;
  }

  hurtbox() {
    const bh = this.meta.bodyH * (this.crouching ? 0.55 : 1);
    return { l: this.x - HALF_W, r: this.x + HALF_W, t: this.y - bh, b: this.y };
  }

  attackBox() {
    if (this.state !== 'jab' && this.state !== 'special') return null;
    if (this.hitDone) return null;
    const p = this.t / tagMs(this.meta, this.tag);
    if (p < this.atk.a0 || p > this.atk.a1) return null;
    const f = frameAt(this.meta, this.tag, this.t);
    let reach = this.fwd(f) + (this.state === 'special' ? SPECIAL_BONUS : JAB_BONUS);
    if (reach <= this.idleFwd + 6) return null;
    const x2 = this.x + this.face * reach;
    const bh = this.meta.bodyH;
    return {
      l: Math.min(this.x, x2), r: Math.max(this.x, x2),
      t: this.y - bh * this.atk.hi, b: this.y - bh * this.atk.lo,
    };
  }

  startAttack(kind) {
    this.state = kind === 'Jab' ? 'jab' : 'special';
    this.atk = kind === 'Jab' ? this.stats.jab : this.stats.special;
    this.tag = kind;
    this.t = 0;
    this.loop = false;
    this.hitDone = false;
    this.animSpeed = tagMs(this.meta, kind) / this.atk.ms;
    this.crouching = false;
    if (this.grounded) this.vx = 0;
  }

  // renvoie 'hit' | 'block' | 'ko'
  receiveHit(atk, dir, attackerState) {
    const canBlock = this.grounded && (this.state === 'free' || this.state === 'block') && this.holdBack;
    if (canBlock) {
      this.hp = Math.max(1, this.hp - Math.ceil(atk.dmg * 0.2));
      this.state = 'block';
      this.stunT = 170;
      this.vx = dir * atk.kb * 0.35;
      this.flash = 0;
      return 'block';
    }
    this.hp = Math.max(0, this.hp - atk.dmg);
    this.state = 'hit';
    this.stunT = atk.stun;
    this.vx = dir * atk.kb;
    this.crouching = false;
    this.flash = 110;
    this.atk = null;
    if (attackerState === 'special') this.vy = -420;
    else if (atk.launch) this.vy = -atk.launch;
    else if (!this.grounded) this.vy = Math.min(this.vy, -150);
    if (this.hp <= 0) {
      this.state = 'ko';
      this.vy = -520;
      this.vx = dir * 320;
      this.tag = 'Fall';
      this.t = 0;
      return 'ko';
    }
    return 'hit';
  }

  win() {
    this.state = 'win';
    this.vx = 0;
    this.play('Idle', true);
  }

  update(dt, opp, canAct) {
    const s = dt / 1000;
    const inp = canAct ? this.controls : NEUTRAL;
    this.cd = Math.max(0, this.cd - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.landT = Math.max(0, this.landT - dt);
    this.buf.jab = Math.max(0, this.buf.jab - dt);
    this.buf.special = Math.max(0, this.buf.special - dt);
    if (inp.pressed.jab) this.buf.jab = BUFFER_MS;
    if (inp.pressed.special) this.buf.special = BUFFER_MS;

    const dirToOpp = Math.sign(opp.x - this.x) || this.face;
    const horiz = (inp.held.right ? 1 : 0) - (inp.held.left ? 1 : 0);
    this.holdBack = horiz !== 0 && horiz === -dirToOpp;
    const wasGrounded = this.grounded;

    switch (this.state) {
      case 'free': this.updateFree(dt, inp, horiz, dirToOpp); break;
      case 'jab':
      case 'special': {
        this.t += dt * this.animSpeed;
        if (this.t >= tagMs(this.meta, this.tag)) {
          if (this.state === 'special') this.cd = this.atk.cd || 400;
          this.state = 'free';
          this.atk = null;
          this.t = 0;
        }
        if (!this.grounded) this.vx *= Math.pow(0.5, s * 4);
        break;
      }
      case 'hit':
        this.stunT -= dt;
        this.vx *= Math.pow(0.03, s);
        this.t += dt;
        if (this.stunT <= 0 && this.grounded) { this.state = 'free'; this.t = 0; }
        break;
      case 'block':
        this.stunT -= dt;
        this.vx *= Math.pow(0.03, s);
        if (this.stunT <= 0) this.state = 'free';
        break;
      case 'ko':
        this.t += dt;
        this.vx *= Math.pow(0.15, s);
        break;
      case 'win':
        this.t += dt;
        break;
      default: break;
    }

    // physique
    this.x += this.vx * s;
    if (this.y < FLOOR || this.vy < 0) {
      this.y += this.vy * s;
      this.vy += GRAV * s;
      if (this.y >= FLOOR) {
        this.y = FLOOR;
        this.vy = 0;
        if (this.state === 'free') this.landT = 130;
        if (this.state === 'ko') this.vx *= 0.3;
      }
    }
    this.x = Math.max(ARENA_L, Math.min(ARENA_R, this.x));
    if (!wasGrounded && this.grounded && this.state === 'free') this.vx = 0;
  }

  updateFree(dt, inp, horiz, dirToOpp) {
    this.t += dt;
    const grounded = this.grounded;
    const sp = this.stats.speed;

    if (grounded) {
      this.face = dirToOpp;
      this.crouching = inp.held.down;
      this.vx = this.crouching ? 0 : horiz * sp;
      if (inp.held.up && !this.crouching) {
        this.vy = -JUMP_V;
        this.vx = horiz * sp * 0.9;
        this.t = 0;
      }
    } else {
      this.crouching = false;
      this.vx = horiz !== 0 ? horiz * sp * 0.9 : this.vx * 0.97;
    }

    // attaques (avec buffer)
    if (this.buf.special > 0 && this.cd <= 0) {
      this.buf.special = 0;
      this.startAttack('Special');
      return;
    }
    if (this.buf.jab > 0) {
      this.buf.jab = 0;
      this.startAttack('Jab');
      return;
    }

    // animation
    if (!this.grounded) this.play(this.vy < 0 ? 'Jump' : 'Fall', false);
    else if (this.crouching) this.play('Landing', false);
    else if (this.landT > 0) this.play('Landing', false);
    else if (horiz !== 0) this.play('Walk', true);
    else this.play('Idle', true);
  }

  render() {
    const m = this.meta;
    let frame;
    if (this.state === 'free') {
      if (this.crouching) {
        const [a, b] = m.tags.Landing;
        frame = Math.min(a + 1, b);
      } else {
        frame = frameAt(m, this.tag, this.t, this.loop);
      }
    } else if (this.state === 'jab' || this.state === 'special') {
      frame = frameAt(m, this.tag, this.t);
    } else if (this.state === 'hit' || this.state === 'block') {
      frame = m.tags.Idle[0];
    } else if (this.state === 'ko') {
      frame = m.tags.Fall[1];
    } else {
      frame = frameAt(m, 'Idle', this.t, true);
    }
    const sp = this.sprite;
    sp.setFrame(frame);
    sp.setScale(flipFor(m, this.face), 1);
    let ox = 0;
    if (this.state === 'hit' && this.flash > 0) ox = (Math.floor(this.flash / 25) % 2 ? 3 : -3);
    sp.setPosition(this.x + ox, this.y);

    if (this.state === 'ko' && this.grounded) {
      sp.setAngle(-this.face * 90);
      sp.y = this.y - 26;
    } else if (this.state === 'ko') {
      sp.setAngle(-this.face * 25);
    } else {
      sp.setAngle(0);
    }

    if (this.flash > 0) sp.setTintFill(0xffffff);
    else if (this.state === 'hit') sp.setTint(0xff8d8d);
    else if (this.state === 'block') sp.setTint(0x9fc4ff);
    else sp.clearTint();

    const h = Math.max(0, (FLOOR - this.y) / 220);
    this.shadow.setPosition(this.x, FLOOR + 2).setScale(1 - Math.min(0.5, h), 1 - Math.min(0.5, h));
  }
}
