import Phaser from 'phaser';
import { W, H, FONT, GRID, CHARS, ROSTER } from '../config.js';
import { Controls } from '../controls.js';
import { Puppet } from '../anim.js';

const BLINK_MS = 500;

// Écran de sélection (Others/Selection_Card.aseprite). Chaque joueur déplace son cadre (1P rouge / 2P bleu),
// confirme avec poing, annule avec spécial. Bouton "?" (ou touche H) = menu des touches.
export class Select extends Phaser.Scene {
  constructor() { super('Select'); }

  create() {
    const L = this.registry.get('meta')._select;
    this.L = L;
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.add.image(0, 0, 'select_bg').setOrigin(0);

    this.controls = [new Controls(this, 0), new Controls(this, 1)];
    this.p = [
      { col: 0, row: 0, ok: false, pick: null },
      { col: 2, row: 0, ok: false, pick: null },
    ];
    this.cursor = [
      this.add.image(0, 0, 'card_1p').setOrigin(0).setScale(2).setDepth(5),
      this.add.image(0, 0, 'card_2p').setOrigin(0).setDepth(5),
    ];
    this.puppets = [];
    this.portrait = [];
    const boxes = [L.portrait1, L.portrait2];
    for (let i = 0; i < 2; i++) {
      const [x, y, w] = boxes[i];
      this.portrait.push(this.add.image(x, y, 'card_Enzo').setOrigin(0).setScale(2).setDepth(2));
      this.puppets.push(new Puppet(this, 'Enzo', x + w / 2, y - 6, 1, i === 0 ? 1 : -1));
      this.puppets[i].sprite.setDepth(3);
    }
    this.buildHelp();
    this.blinkT = 0;
    this.launching = false;
    this.refresh();
  }

  // --- menu des touches --------------------------------------------------------------------------
  buildHelp() {
    const objs = [];
    objs.push(this.add.rectangle(0, 0, W, H, 0x000000, 0.8).setOrigin(0));
    const st = (size, color = '#ffffff') => ({ fontFamily: FONT, fontSize: `${size}px`, color, lineSpacing: 6 });
    objs.push(this.add.text(W / 2, 22, 'TOUCHES', { ...st(26, '#ffe35a'), fontStyle: 'bold' }).setOrigin(0.5, 0));
    objs.push(this.add.text(120, 70, [
      'JOUEUR 1', '', 'Déplacer   Q / D', 'Sauter     Z', 'Baisser    S', 'Poing (A)  F', 'Spécial (B) G', 'Bloquer    tenir la direction',
      '           opposée à l\'adversaire',
    ].join('\n'), st(15, '#ff8a8a')));
    objs.push(this.add.text(W - 120, 70, [
      'JOUEUR 2', '', 'Déplacer   ← / →', 'Sauter     ↑', 'Baisser    ↓', 'Poing (A)  K  (pavé num. 1)', 'Spécial (B) L  (pavé num. 2)', 'Bloquer    idem',
    ].join('\n'), st(15, '#9fb4ff')).setOrigin(1, 0));
    objs.push(this.add.text(W / 2, 250, 'COUPS', { ...st(18, '#ffe35a'), fontStyle: 'bold' }).setOrigin(0.5, 0));
    const lines = CHARS.map((c) => `${ROSTER[c].label.padEnd(8)} A ${ROSTER[c].jab.name.padEnd(20)} B ${ROSTER[c].special.name}`);
    objs.push(this.add.text(W / 2, 284, lines.join('\n'), st(15)).setOrigin(0.5, 0));
    objs.push(this.add.text(W / 2, H - 56, 'Manette : croix / stick, A ou X = poing, B ou Y = spécial', st(13, '#cfd8dc')).setOrigin(0.5, 0));
    objs.push(this.add.text(W / 2, H - 32, 'Poing = valider · Spécial = annuler · H ou ? = fermer', st(13, '#cfd8dc')).setOrigin(0.5, 0));
    this.help = this.add.container(0, 0, objs).setDepth(50).setVisible(false);

    // bouton "?" cliquable en bas à droite
    const btn = this.add.container(W - 28, 28).setDepth(40);
    btn.add(this.add.circle(0, 0, 15, 0x000000, 0.65).setStrokeStyle(3, 0xffffff));
    btn.add(this.add.text(0, 0, '?', { fontFamily: FONT, fontSize: '20px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
    btn.setSize(34, 34).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.toggleHelp());
    this.helpBtn = btn;
    this.helpKeys = this.input.keyboard.addKeys('H,ESC,TAB');
    this.input.keyboard.on('keydown-H', () => this.toggleHelp());
    this.input.keyboard.on('keydown-TAB', () => this.toggleHelp());
    this.input.keyboard.on('keydown-ESC', () => { if (this.help.visible) this.toggleHelp(); });
  }

  toggleHelp() {
    this.help.setVisible(!this.help.visible);
  }

  // --- sélection ---------------------------------------------------------------------------------
  cellName(p) { return GRID[p.row][p.col]; }

  refresh() {
    const L = this.L;
    for (let i = 0; i < 2; i++) {
      const p = this.p[i];
      const name = p.ok ? p.pick : this.cellName(p);
      const shown = name === 'RANDOM' ? null : name;
      this.cursor[i].setPosition(L.cellX0 + p.col * L.cell + (i === 1 && this.p[0].col === p.col && this.p[0].row === p.row ? 3 : 0),
        L.cellY0 + p.row * L.cell);
      if (shown) {
        this.portrait[i].setTexture(`card_${shown}`).setVisible(true);
        if (this.puppets[i].name !== shown) this.puppets[i].setChar(shown);
        this.puppets[i].sprite.setVisible(true);
      } else {
        this.portrait[i].setVisible(false);
        this.puppets[i].sprite.setVisible(false);
      }
    }
  }

  confirm(i) {
    const p = this.p[i];
    if (p.ok) return;
    const cell = this.cellName(p);
    p.pick = cell === 'RANDOM' ? Phaser.Utils.Array.GetRandom(CHARS) : cell;
    p.ok = true;
    this.puppets[i].setChar(p.pick);
    this.puppets[i].play('Jab', false);
    this.refresh();
  }

  update(_, delta) {
    this.blinkT += delta;
    const locked = this.help.visible;
    for (let i = 0; i < 2; i++) {
      const c = this.controls[i];
      const p = this.p[i];
      c.poll();
      if (!locked) {
        if (!p.ok) {
          let moved = false;
          if (c.pressed.left) { p.col = (p.col + 2) % 3; moved = true; }
          if (c.pressed.right) { p.col = (p.col + 1) % 3; moved = true; }
          if (c.pressed.up || c.pressed.down) { p.row = 1 - p.row; moved = true; }
          if (moved) this.refresh();
          if (c.pressed.jab || c.pressed.start) this.confirm(i);
        } else if (c.pressed.special) {
          p.ok = false;
          this.refresh();
        }
      }
      // les cadres clignotent (lentement) tant que le choix n'est pas validé
      this.cursor[i].setVisible(p.ok || Math.floor(this.blinkT / BLINK_MS) % 2 === 0);
      this.puppets[i].update(delta);
    }

    if (this.p.every((p) => p.ok) && !this.launching) {
      this.launching = true;
      this.time.delayedCall(700, () => {
        this.cameras.main.fadeOut(250, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () =>
          this.scene.start('Versus', { p1: this.p[0].pick, p2: this.p[1].pick }));
      });
    }
  }
}
