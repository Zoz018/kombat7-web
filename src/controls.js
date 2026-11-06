import { KEYMAPS } from './config.js';

const ACTIONS = ['left', 'right', 'up', 'down', 'jab', 'special', 'start'];

// Un Controls = un joueur (clavier + manette éventuelle). Appeler poll() une fois par frame.
export class Controls {
  constructor(scene, index) {
    this.scene = scene;
    this.index = index;
    this.keys = {};
    for (const [action, codes] of Object.entries(KEYMAPS[index])) {
      this.keys[action] = codes.map((c) => scene.input.keyboard.addKey(c, true));
    }
    this.held = {};
    this.pressed = {};
    for (const a of ACTIONS) { this.held[a] = false; this.pressed[a] = false; }
  }

  pad() {
    const gp = this.scene.input.gamepad;
    return gp && gp.total > this.index ? gp.getPad(this.index) : null;
  }

  poll() {
    const now = {};
    for (const a of ACTIONS) now[a] = this.keys[a].some((k) => k.isDown);
    const pad = this.pad();
    if (pad) {
      const sx = pad.axes.length > 0 ? pad.axes[0].getValue() : 0;
      const sy = pad.axes.length > 1 ? pad.axes[1].getValue() : 0;
      const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
      now.left = now.left || pad.left || sx < -0.4;
      now.right = now.right || pad.right || sx > 0.4;
      now.up = now.up || pad.up || sy < -0.6;
      now.down = now.down || pad.down || sy > 0.6;
      now.jab = now.jab || b(0) || b(2);
      now.special = now.special || b(1) || b(3);
      now.start = now.start || b(9);
    }
    for (const a of ACTIONS) {
      this.pressed[a] = now[a] && !this.held[a];
      this.held[a] = now[a];
    }
  }
}

export const NEUTRAL = {
  held: { left: false, right: false, up: false, down: false, jab: false, special: false, start: false },
  pressed: { left: false, right: false, up: false, down: false, jab: false, special: false, start: false },
};
