import Phaser from 'phaser';
import { W, H, CHARS, FONT } from '../config.js';
import { loadAudio } from '../audio.js';

// Charge meta.json puis tous les assets générés par tools/build_assets.py
export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.json('meta', 'assets/meta.json');
  }

  create() {
    this.registry.set('meta', this.cache.json.get('meta'));
    this.scene.start('Preload');
  }
}

export class Preload extends Phaser.Scene {
  constructor() { super('Preload'); }

  preload() {
    const meta = this.registry.get('meta');
    const txt = this.add.text(W / 2, H / 2, 'CHARGEMENT 0%', { fontFamily: FONT, fontSize: '20px', color: '#cfe3cf' }).setOrigin(0.5);
    this.load.on('progress', (p) => txt.setText(`CHARGEMENT ${Math.round(p * 100)}%`));

    for (const c of CHARS) {
      const m = meta[c];
      this.load.spritesheet(`char_${c}`, `assets/char_${c}.png`, { frameWidth: m.fw, frameHeight: m.fh });
      this.load.image(`card_${c}`, `assets/card_${c}.png`);
      this.load.image(`flag_${c}`, `assets/flag_${c}.png`);
    }
    loadAudio(this);
    this.load.image('start', 'assets/start.png');
    this.load.image('select_bg', 'assets/select_bg.png');
    this.load.image('life', 'assets/life.png');
    this.load.image('churros', 'assets/churros.png');
    this.load.image('card_1p', 'assets/card_1p.png');
    this.load.image('card_2p', 'assets/card_2p.png');
    this.load.image('versus_bg', 'assets/versus_bg.png');
    this.load.image('vs_glyph', 'assets/vs_glyph.png');
    const st = meta._studio;
    this.load.spritesheet('studio', 'assets/studio.png', { frameWidth: st.w, frameHeight: st.h });
  }

  create() {
    this.scene.start('Studio');
  }
}
