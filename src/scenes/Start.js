import Phaser from 'phaser';
import { Controls } from '../controls.js';
import { music, sfx } from '../audio.js';

// Écran Start (Others/Start_Screen.aseprite). Le "PRESS START" dessiné dans l'image est masqué puis clignote.
export class Start extends Phaser.Scene {
  constructor() { super('Start'); }

  create() {
    this.cameras.main.setBackgroundColor('#000000');
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.add.image(0, 0, 'start').setOrigin(0);
    // zone du texte "PRESS START" (x 457-554, y 347-355) recouverte par la couleur du fond
    this.cover = this.add.rectangle(454, 345, 104, 13, 0x91aa8f).setOrigin(0);
    // le texte original (recréé en pixel via un 2e rendu de l'image croppée) clignote
    this.press = this.add.image(0, 0, 'start').setOrigin(0).setCrop(454, 345, 104, 13);
    this.press.setDepth(1);
    this.cover.setDepth(0.5);
    this.blink = 0;

    this.controls = [new Controls(this, 0), new Controls(this, 1)];
    this.go = false;
    music(this, 'music_menu');
  }

  update(_, delta) {
    this.blink += delta;
    this.press.setVisible(Math.floor(this.blink / 500) % 2 === 0);
    for (const c of this.controls) c.poll();
    if (this.controls.some((c) => c.pressed.start || c.pressed.jab || c.pressed.special) && !this.go) {
      this.go = true;
      sfx(this, 'start');
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Mode'));
    }
  }
}

