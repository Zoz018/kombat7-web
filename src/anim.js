// Animation basée sur les tags + durées exportés depuis les .aseprite (public/assets/meta.json)

export function tagMs(meta, tag) {
  const [a, b] = meta.tags[tag];
  let total = 0;
  for (let i = a; i <= b; i++) total += meta.durations[i];
  return total;
}

// t = temps écoulé (ms, temps "original" des durées aseprite) -> index de frame
export function frameAt(meta, tag, t, loop = false) {
  const [a, b] = meta.tags[tag];
  const total = tagMs(meta, tag);
  if (loop && total > 0) t = t % total;
  let acc = 0;
  for (let i = a; i <= b; i++) {
    acc += meta.durations[i];
    if (t < acc) return i;
  }
  return b;
}

// Les sprites sont dessinés vers la gauche (meta.faceRight=false). face = +1 (droite) ou -1 (gauche)
export function flipFor(meta, face) {
  return (face === 1) === meta.faceRight ? 1 : -1;
}

// Petit personnage animé pour les menus (sélection, versus, victoire)
export class Puppet {
  constructor(scene, name, x, y, scale = 1, face = 1) {
    this.scene = scene;
    this.scale = scale;
    this.face = face;
    this.sprite = scene.add.sprite(x, y, `char_${name}`, 0);
    this.setChar(name);
  }

  setChar(name) {
    this.name = name;
    this.meta = this.scene.registry.get('meta')[name];
    this.sprite.setTexture(`char_${name}`, 0);
    this.sprite.setOrigin(0.5, this.meta.ay / this.meta.fh);
    this.play('Idle', true);
    this.applyFace();
  }

  applyFace() {
    this.sprite.setScale(this.scale * flipFor(this.meta, this.face), this.scale);
  }

  play(tag, loop = true) {
    this.tag = tag;
    this.loop = loop;
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    if (!this.loop && this.t >= tagMs(this.meta, this.tag)) this.play('Idle', true);
    this.sprite.setFrame(frameAt(this.meta, this.tag, this.t, this.loop));
  }
}
