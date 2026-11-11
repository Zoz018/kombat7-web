import Phaser from 'phaser';
import { W, H } from './config.js';
import { Boot, Preload } from './scenes/Boot.js';
import { Studio } from './scenes/Studio.js';
import { Start } from './scenes/Start.js';
import { Mode } from './scenes/Mode.js';
import { Select } from './scenes/Select.js';
import { Versus } from './scenes/Versus.js';
import { Fight } from './scenes/Fight.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#000000',
  pixelArt: true,
  input: { gamepad: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot, Preload, Studio, Start, Mode, Select, Versus, Fight],
});

// M = couper / remettre le son
window.addEventListener('keydown', (e) => { if (e.code === 'KeyM' && !e.repeat) game.sound.mute = !game.sound.mute; });

// pratique pour déboguer depuis la console / les tests
window.__game = game;
