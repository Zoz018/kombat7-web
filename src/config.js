import Phaser from 'phaser';

export const W = 1024;
export const H = 512;
export const FLOOR = 448; // ligne du sol (pieds des combattants)
export const ARENA_L = 40;
export const ARENA_R = W - 40;
export const MAX_HP = 100;
export const ROUND_TIME = 60;
export const ROUNDS_TO_WIN = 2;

export const FONT = '"Courier New", monospace';

// Persos. Noms/coups tirés de drawing/Moove.txt.
//  jab / special : dmg, ms = durée voulue (l'anim est accélérée/ralentie pour coller),
//  a0..a1 = fenêtre active (fraction de l'anim), lo..hi = zone touchée (fraction de la hauteur du corps)
//  stun = temps de stun infligé (ms), kb = recul (px/s)
export const ROSTER = {
  Sami: {
    label: 'SAMI', speed: 255,
    jab: { name: 'Coup de poing', dmg: 7, ms: 340, a0: 0.2, a1: 0.65, lo: 0.35, hi: 1.0, stun: 260, kb: 160 },
    special: { name: 'Notes de guitare', dmg: 16, ms: 900, a0: 0.4, a1: 0.9, lo: 0.0, hi: 1.0, stun: 420, kb: 380, cd: 500 },
  },
  Matthis: {
    label: 'MATTHIS', speed: 270,
    jab: { name: 'Coup de poing', dmg: 7, ms: 400, a0: 0.2, a1: 0.75, lo: 0.35, hi: 1.0, stun: 260, kb: 160 },
    special: { name: 'Shuriken', dmg: 13, ms: 520, a0: 0.2, a1: 0.9, lo: 0.0, hi: 1.0, stun: 380, kb: 300, cd: 350 },
  },
  Leo: {
    label: 'LEO', speed: 245,
    jab: { name: 'Crochet', dmg: 9, ms: 420, a0: 0.2, a1: 0.75, lo: 0.35, hi: 1.0, stun: 280, kb: 220 },
    special: { name: 'Flash laser', dmg: 17, ms: 900, a0: 0.4, a1: 0.85, lo: 0.0, hi: 1.0, stun: 430, kb: 380, cd: 500 },
  },
  Julien: {
    label: 'JULIEN', speed: 285,
    jab: { name: 'Poing ultra rapide', dmg: 5, ms: 230, a0: 0.3, a1: 0.8, lo: 0.35, hi: 1.0, stun: 200, kb: 120 },
    special: { name: 'Gun drapeau US', dmg: 15, ms: 650, a0: 0.2, a1: 0.9, lo: 0.0, hi: 1.0, stun: 400, kb: 340, cd: 400 },
  },
  Enzo: {
    label: 'ENZO', speed: 260,
    jab: { name: 'Uppercut', dmg: 10, ms: 440, a0: 0.4, a1: 0.9, lo: 0.2, hi: 1.5, stun: 320, kb: 200, launch: 280 },
    special: { name: 'Ballon de volley', dmg: 18, ms: 1000, a0: 0.3, a1: 0.95, lo: 0.0, hi: 1.0, stun: 450, kb: 420, cd: 600 },
  },
};

export const CHARS = Object.keys(ROSTER);

// Grille de sélection (comme dans Selection_Card.aseprite)
export const GRID = [
  ['Enzo', 'Leo', 'Matthis'],
  ['Sami', 'Julien', 'RANDOM'],
];

const K = Phaser.Input.Keyboard.KeyCodes;
// Claviers : J1 à gauche (ZQSD), J2 à droite (flèches). Q/A et Z/W acceptés pour AZERTY et QWERTY.
export const KEYMAPS = [
  { left: [K.Q, K.A], right: [K.D], up: [K.Z, K.W], down: [K.S], jab: [K.F], special: [K.G], start: [K.SPACE] },
  { left: [K.LEFT], right: [K.RIGHT], up: [K.UP], down: [K.DOWN], jab: [K.K, K.NUMPAD_ONE], special: [K.L, K.NUMPAD_TWO], start: [K.ENTER] },
];
