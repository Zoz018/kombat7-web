// Sons générés par tools/build_sounds.py (public/assets/audio/*.wav)
export const SFX = ['blink', 'menu_move', 'menu_ok', 'menu_back', 'start', 'pick', 'pause', 'swing', 'hit', 'special',
  'hit_special', 'block', 'jump', 'land', 'ko', 'fight', 'round', 'vs', 'tick'];
export const MUSIC = ['music_menu', 'music_fight', 'music_win'];

// les bruitages restent plus discrets que la musique
const SFX_GAIN = 0.5;

export function loadAudio(scene) {
  for (const k of SFX) scene.load.audio(`sfx_${k}`, `assets/audio/sfx_${k}.wav`);
  for (const k of MUSIC) scene.load.audio(k, `assets/audio/${k}.wav`);
}

export function sfx(scene, key, volume = 0.7) {
  scene.sound.play(`sfx_${key}`, { volume: volume * SFX_GAIN });
}

// Une seule musique à la fois, qui continue d'une scène à l'autre tant que c'est la même piste.
export function music(scene, key, volume = 0.4, loop = true) {
  const sm = scene.sound;
  if (sm.bgm && sm.bgm.key === key && sm.bgm.isPlaying) { sm.bgm.setVolume(volume); return; }
  stopMusic(scene);
  sm.bgm = sm.add(key, { loop, volume });
  sm.bgm.play();
}

export function stopMusic(scene) {
  const sm = scene.sound;
  if (sm.bgm) { sm.bgm.stop(); sm.bgm.destroy(); sm.bgm = null; }
}

export function setMusicVolume(scene, v) {
  if (scene.sound.bgm) scene.sound.bgm.setVolume(v);
}
