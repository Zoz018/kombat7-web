import Phaser from 'phaser';
import { W, H, FONT, ROSTER } from '../config.js';
import { Puppet } from '../anim.js';

// Écran de lancement de la partie. Le "VS" vient de Others/Versus_Screen.aseprite (détouré),
// les combattants sont ceux choisis (pas encore de dessin dédié par duo).
export class Versus extends Phaser.Scene {
  constructor() { super('Versus'); }

  init(data) { this.data2 = data; }

  create() {
    const { p1, p2 } = this.data2;
    this.cameras.main.fadeIn(200, 0, 0, 0);
    // fond : Others/Versus_Screen.aseprite (agrandi x4), sans les persos dessinés dedans
    this.add.image(0, 0, 'versus_bg').setOrigin(0).setScale(4).setDepth(-1);

    this.pp = [
      new Puppet(this, p1, -200, H - 12, 3, 1),
      new Puppet(this, p2, W + 200, H - 12, 3, -1),
    ];
    this.pp.forEach((p) => p.sprite.setDepth(2));
    this.tweens.add({ targets: this.pp[0].sprite, x: 270, duration: 450, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.pp[1].sprite, x: W - 270, duration: 450, ease: 'Back.easeOut' });

    const vs = this.add.image(512, 210, 'vs_glyph').setScale(0.1).setDepth(3);
    this.tweens.add({ targets: vs, scale: 5, duration: 380, ease: 'Back.easeOut', delay: 300 });

    const style = { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#000', strokeThickness: 7, fontStyle: 'bold' };
    this.add.text(44, 24, `J1  ${ROSTER[p1].label}`, style).setDepth(4);
    this.add.text(W - 44, 24, `${ROSTER[p2].label}  J2`, style).setOrigin(1, 0).setDepth(4);

    this.time.delayedCall(700, () => this.pp.forEach((p) => p.play('Jab', false)));
    this.time.delayedCall(2300, () => {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Fight', { p1, p2 }));
    });
  }

  update(_, delta) {
    this.pp.forEach((p) => p.update(delta));
  }
}
