import Phaser from 'phaser';
import { W, H } from '../config.js';

// Intro "Studio Grenouille" (Others/Studio_Grenouille.aseprite)
export class Studio extends Phaser.Scene {
  constructor() { super('Studio'); }

  create() {
    this.cameras.main.setBackgroundColor('#ffffff');
    this.durations = this.registry.get('meta')._studio.durations;
    this.img = this.add.sprite(W / 2, H / 2, 'studio', 0).setScale(2);
    this.t = 0;
    this.done = false;
    this.cameras.main.fadeIn(300, 255, 255, 255);
    const skip = () => this.finish();
    this.input.keyboard.once('keydown', skip);
    this.input.once('pointerdown', skip);
  }

  update(_, delta) {
    this.t += delta;
    // lecture unique : on enchaîne les frames puis on garde la dernière
    let t = this.t;
    let f = this.durations.length - 1;
    for (let i = 0; i < this.durations.length; i++) {
      if (t < this.durations[i]) { f = i; break; }
      t -= this.durations[i];
    }
    this.img.setFrame(f);
    const total = this.durations.reduce((a, b) => a + b, 0);
    if (this.t > total + 500) this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Start'));
  }
}
