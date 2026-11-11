import Phaser from 'phaser';
import { W, H, FONT } from '../config.js';
import { Controls } from '../controls.js';
import { music, sfx } from '../audio.js';

const MODES = [
  { id: 'ai', label: '1 JOUEUR', sub: 'contre l\'IA' },
  { id: 'pvp', label: '2 JOUEURS', sub: 'à deux' },
];

// Écran intermédiaire entre Start et Select : choix du mode (contre l'IA ou à deux)
export class Mode extends Phaser.Scene {
  constructor() { super('Mode'); }

  create() {
    this.cameras.main.setBackgroundColor('#000000');
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.add.image(0, 0, 'select_bg').setOrigin(0).setAlpha(0.35);
    this.add.text(W / 2, 90, 'MODE DE JEU', {
      fontFamily: FONT, fontSize: '48px', color: '#ff0000', stroke: '#000', strokeThickness: 8, fontStyle: 'bold',
    }).setOrigin(0.5);

    this.sel = 0;
    this.go = false;
    music(this, 'music_menu');
    this.cards = MODES.map((m, i) => {
      const x = W / 2 + (i === 0 ? -170 : 170);
      const box = this.add.rectangle(x, H / 2 + 30, 290, 190, 0x000000, 0.7).setStrokeStyle(4, 0xffffff);
      const title = this.add.text(x, H / 2 + 5, m.label, { fontFamily: FONT, fontSize: '34px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
      const sub = this.add.text(x, H / 2 + 55, m.sub, { fontFamily: FONT, fontSize: '22px', color: '#cfd8dc' }).setOrigin(0.5);
      box.setInteractive({ useHandCursor: true });
      box.on('pointerover', () => { this.sel = i; this.refresh(); });
      box.on('pointerdown', () => { this.sel = i; this.refresh(); this.choose(); });
      return { box, title, sub };
    });

    this.controls = [new Controls(this, 0), new Controls(this, 1)];
    this.refresh();
  }

  refresh() {
    this.cards.forEach((c, i) => {
      const on = i === this.sel;
      c.box.setStrokeStyle(on ? 6 : 3, on ? 0xff0000 : 0xffffff);
      c.title.setColor(on ? '#ff0000' : '#ffffff');
    });
  }

  choose() {
    if (this.go) return;
    this.go = true;
    sfx(this, 'menu_ok');
    this.registry.set('mode', MODES[this.sel].id);
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Select'));
  }

  update() {
    for (const c of this.controls) c.poll();
    if (this.go) return;
    if (this.controls.some((c) => c.pressed.left || c.pressed.right)) {
      this.sel = 1 - this.sel;
      this.refresh();
      sfx(this, 'menu_move');
    }
    if (this.controls.some((c) => c.pressed.jab || c.pressed.start)) this.choose();
    else if (this.controls.some((c) => c.pressed.special)) { sfx(this, 'menu_back'); this.scene.start('Start'); }
  }
}
