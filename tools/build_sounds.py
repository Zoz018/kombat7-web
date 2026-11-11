#!/usr/bin/env python3
"""Synthétise les bruitages et musiques (style arcade/chiptune) dans public/assets/audio/*.wav
Usage: python tools/build_sounds.py   (nécessite numpy)
"""
import wave
from pathlib import Path
import numpy as np

SR = 22050
OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'audio'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)


# --- oscillateurs ---------------------------------------------------------------------------------
def tt(dur):
    return np.arange(int(SR * dur)) / SR


def phase(freq):
    """freq : scalaire ou tableau (Hz par échantillon) -> phase cumulée en cycles"""
    return np.cumsum(np.broadcast_to(freq, np.shape(freq)) / SR) if np.ndim(freq) else None


def osc(kind, freq, dur, duty=0.5):
    n = int(SR * dur)
    f = np.full(n, float(freq)) if np.ndim(freq) == 0 else np.asarray(freq, dtype=float)
    ph = np.cumsum(f / SR)
    frac = ph % 1.0
    if kind == 'sine':
        return np.sin(2 * np.pi * ph)
    if kind == 'square':
        return np.where(frac < duty, 1.0, -1.0)
    if kind == 'tri':
        return 4 * np.abs(frac - 0.5) - 1
    if kind == 'saw':
        return 2 * frac - 1
    raise ValueError(kind)


def noise(dur):
    return rng.uniform(-1, 1, int(SR * dur))


def lowpass(x, a):
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += a * (v - acc)
        y[i] = acc
    return y


def highpass(x, a):
    return x - lowpass(x, a)


def env(n, attack=0.004, decay=None, sustain=1.0, release=0.02):
    """enveloppe simple : attaque linéaire, décroissance exponentielle (decay en s) ou palier, relâchement"""
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / max(attack, 1e-4))
    if decay:
        e = e * (sustain + (1 - sustain) * np.exp(-t / decay))
    r = int(release * SR)
    if r > 0 and n > r:
        e[-r:] *= np.linspace(1, 0, r)
    return e


def sweep(f0, f1, dur, curve=1.0):
    n = int(SR * dur)
    x = np.linspace(0, 1, n) ** curve
    return f0 + (f1 - f0) * x


def mix(*sigs, length=None):
    n = length or max(len(s) for s in sigs)
    out = np.zeros(n)
    for s in sigs:
        out[:len(s)] += s[:n]
    return out


def place(buf, sig, start):
    s = int(start * SR)
    if s >= len(buf):
        return
    e = min(len(buf), s + len(sig))
    buf[s:e] += sig[:e - s]


def save(name, x, peak=0.9):
    m = np.max(np.abs(x)) or 1
    x = x / m * peak
    pcm = (x * 32767).astype('<i2')
    with wave.open(str(OUT / f'{name}.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f'{name}.wav  {len(x) / SR:.2f}s')


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


NOTES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def midi(name):
    """'A4', 'C#5', 'Bb3' -> numéro MIDI"""
    n = NOTES[name[0]]
    i = 1
    while i < len(name) and name[i] in '#b':
        n += 1 if name[i] == '#' else -1
        i += 1
    return 12 * (int(name[i:]) + 1) + n


# --- instruments ------------------------------------------------------------------------------------
def lead(freq, dur, vol=0.22, duty=0.25):
    n = int(SR * dur)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * np.arange(n) / SR) * np.minimum(1, np.arange(n) / (0.15 * SR))
    return osc('square', freq * vib, dur, duty) * env(n, 0.004, 0.5, 0.65, 0.03) * vol


def bass(freq, dur, vol=0.3):
    n = int(SR * dur)
    return (osc('tri', freq, dur) * 0.8 + osc('square', freq, dur, 0.5) * 0.25) * env(n, 0.003, 0.18, 0.5, 0.02) * vol


def arp(freq, dur, vol=0.07):
    n = int(SR * dur)
    return osc('square', freq, dur, 0.125) * env(n, 0.002, 0.08, 0.3, 0.01) * vol


def kick(vol=0.8):
    d = 0.16
    f = sweep(170, 45, d, 0.4)
    return osc('sine', f, d) * env(int(SR * d), 0.001, 0.05, 0.0, 0.02) * vol


def snare(vol=0.5):
    d = 0.14
    n = int(SR * d)
    return (highpass(noise(d), 0.15) * 0.8 + osc('sine', 190, d) * 0.4) * env(n, 0.001, 0.045, 0.0, 0.02) * vol


def hat(vol=0.18, open_=False):
    d = 0.09 if open_ else 0.035
    n = int(SR * d)
    return highpass(noise(d), 0.5) * env(n, 0.001, 0.025 if open_ else 0.012, 0.0, 0.005) * vol


# --- bruitages -------------------------------------------------------------------------------------
def blip(f, dur=0.06, vol=0.5, kind='square'):
    n = int(SR * dur)
    return osc(kind, f, dur, 0.5) * env(n, 0.002, None, 1.0, 0.015) * vol


def build_sfx():
    # clignement de la grenouille : petit "bloup" liquide qui monte puis redescend
    d = 0.22
    f = np.concatenate([sweep(260, 720, 0.09, 0.8), sweep(720, 420, 0.13, 1.0)])
    x = osc('sine', f, d) * env(len(f), 0.004, 0.12, 0.2, 0.05)
    x2 = osc('sine', f * 2.0, d) * env(len(f), 0.004, 0.06, 0.0, 0.05) * 0.35
    save('sfx_blink', mix(x, x2))

    save('sfx_menu_move', blip(880, 0.045, 0.5))
    save('sfx_menu_ok', mix(blip(660, 0.07), np.concatenate([np.zeros(int(0.07 * SR)), blip(990, 0.12)])))
    save('sfx_menu_back', mix(blip(620, 0.07), np.concatenate([np.zeros(int(0.07 * SR)), blip(410, 0.12)])))
    save('sfx_start', mix(*[np.concatenate([np.zeros(int(i * 0.07 * SR)), blip(hz(m), 0.18, 0.45)]) for i, m in enumerate([60, 64, 67, 72, 76])]))

    # confirmation du perso : arpège joyeux + "ding"
    parts = [np.concatenate([np.zeros(int(i * 0.06 * SR)), lead(hz(m), 0.22, 0.3, 0.5)]) for i, m in enumerate([67, 71, 74, 79])]
    ding = np.concatenate([np.zeros(int(0.24 * SR)), osc('sine', hz(91), 0.3) * env(int(0.3 * SR), 0.002, 0.12, 0.0, 0.05) * 0.2])
    save('sfx_pick', mix(*parts, ding))
    save('sfx_pause', mix(blip(500, 0.06), np.concatenate([np.zeros(int(0.06 * SR)), blip(750, 0.1)])))

    # coup de poing dans le vide : souffle
    d = 0.16
    nz = noise(d)
    x = lowpass(nz, 0.4) * np.sin(np.pi * np.linspace(0, 1, len(nz))) ** 1.5
    save('sfx_swing', x * 0.7)
    # poing qui touche : claque + impact grave
    d = 0.2
    n = int(SR * d)
    punch = highpass(noise(d), 0.25) * env(n, 0.001, 0.03, 0.0, 0.01) * 0.7 + osc('sine', sweep(190, 60, d, 0.5), d) * env(n, 0.001, 0.08, 0.0, 0.02) * 0.9
    save('sfx_hit', punch)
    # coup spécial : laser descendant + grésillement
    d = 0.45
    n = int(SR * d)
    sp = osc('square', sweep(1500, 180, d, 0.6), d, 0.25) * env(n, 0.003, 0.25, 0.2, 0.05) * 0.5
    sp += osc('saw', sweep(750, 90, d, 0.6), d) * env(n, 0.003, 0.2, 0.1, 0.05) * 0.3
    save('sfx_special', sp)
    # spécial qui touche : grosse explosion
    d = 0.5
    n = int(SR * d)
    boom = lowpass(noise(d), 0.25) * env(n, 0.001, 0.16, 0.0, 0.05) * 1.0 + osc('sine', sweep(140, 35, d, 0.5), d) * env(n, 0.001, 0.2, 0.0, 0.05) * 0.9
    boom += highpass(noise(d), 0.3) * env(n, 0.001, 0.04, 0.0, 0.01) * 0.5
    save('sfx_hit_special', boom)
    # blocage : "clang" métallique
    d = 0.22
    n = int(SR * d)
    clang = sum(osc('square', f, d, 0.5) * 0.25 for f in (1350, 1870, 2630)) * env(n, 0.001, 0.05, 0.0, 0.02)
    clang += highpass(noise(0.22), 0.4) * env(n, 0.001, 0.015, 0.0, 0.01) * 0.4
    save('sfx_block', clang * 0.5)
    save('sfx_jump', osc('sine', sweep(260, 620, 0.12, 0.7), 0.12) * env(int(0.12 * SR), 0.003, 0.08, 0.2, 0.03) * 0.6)
    save('sfx_land', lowpass(noise(0.08), 0.3) * env(int(0.08 * SR), 0.001, 0.025, 0.0, 0.01) * 0.6)
    # K.O. : chute grave + impact
    d = 0.9
    n = int(SR * d)
    ko = osc('square', sweep(900, 60, d, 0.45), d, 0.5) * env(n, 0.003, 0.5, 0.25, 0.1) * 0.4
    ko += lowpass(noise(d), 0.15) * env(n, 0.001, 0.2, 0.0, 0.1) * 0.8
    ko += osc('sine', sweep(100, 30, d, 0.5), d) * env(n, 0.001, 0.4, 0.0, 0.1) * 0.7
    save('sfx_ko', ko)
    # annonce "FIGHT !" : accord de cuivres + impact
    d = 0.7
    n = int(SR * d)
    stab = sum(osc('saw', hz(m), d) * 0.14 for m in (57, 64, 69, 76)) * env(n, 0.005, 0.35, 0.3, 0.1)
    imp = np.zeros(n)
    place(imp, osc('sine', sweep(130, 40, 0.25, 0.5), 0.25) * env(int(0.25 * SR), 0.001, 0.1, 0.0, 0.03) * 0.9, 0)
    save('sfx_fight', mix(stab, imp))
    # "MANCHE n" : double bip
    save('sfx_round', mix(blip(440, 0.09, 0.5), np.concatenate([np.zeros(int(0.12 * SR)), blip(660, 0.16, 0.5)])))
    # écran VS : gros impact avec réverb courte
    d = 1.0
    n = int(SR * d)
    vs = lowpass(noise(d), 0.2) * env(n, 0.001, 0.22, 0.0, 0.1) * 0.9 + osc('sine', sweep(110, 32, d, 0.4), d) * env(n, 0.001, 0.35, 0.0, 0.1) * 1.0
    vs += osc('saw', hz(45), d) * env(n, 0.002, 0.4, 0.0, 0.1) * 0.25
    save('sfx_vs', vs)
    # petit "tic" du chrono qui s'approche de zéro
    save('sfx_tick', blip(1200, 0.03, 0.4))


# --- musiques --------------------------------------------------------------------------------------
def gtr(root, dur, vol=0.1):
    """power chord à la guitare saturée (dent de scie filtrée), étouffé"""
    n = int(SR * dur)
    x = sum(osc('saw', hz(root + o), dur) for o in (0, 7, 12)) / 3
    return lowpass(x, 0.22) * env(n, 0.002, 0.07, 0.15, 0.01) * vol


def crash(vol=0.22):
    d = 0.8
    return highpass(noise(d), 0.6) * env(int(SR * d), 0.001, 0.25, 0.0, 0.1) * vol


def render_track(bpm, lead_bars, chords, kit, guitar=True):
    """lead_bars : une chaîne par mesure (16 doubles-croches séparées par espaces ; '-' = tenue, '.' = silence)
    chords : (racine MIDI de la basse, [notes d'arpège]) par mesure ; kit(buf, t0, beat, bar_index, bars) = batterie"""
    bars = len(lead_bars)
    beat = 60.0 / bpm
    sx = beat / 4  # une double-croche
    bar = beat * 4
    buf = np.zeros(int(bar * bars * SR) + SR)
    gallop = [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 12, 0, 12]
    for b in range(bars):
        t0 = b * bar
        root, ch = chords[b]
        for i, off in enumerate(gallop):  # basse en doubles-croches
            place(buf, bass(hz(root + off), sx * 0.9, 0.26), t0 + i * sx)
        for i in range(16):  # arpège aigu
            place(buf, arp(hz(ch[i % 3] + (12 if i % 8 >= 4 else 0)), sx * 0.9, 0.05), t0 + i * sx)
        if guitar:
            for i in range(0, 16, 2):  # accords étouffés en croches
                place(buf, gtr(root + 12, sx * 1.8), t0 + i * sx)
        kit(buf, t0, beat, b, bars)
        steps = (lead_bars[b].split() + ['.'] * 16)[:16]
        assert len(steps) == 16, (b, steps)
        i = 0
        while i < 16:
            s = steps[i]
            if s in ('.', '-'):
                i += 1
                continue
            j = i + 1
            while j < 16 and steps[j] == '-':
                j += 1
            note = lead(hz(midi(s)), (j - i) * sx * 0.95)
            place(buf, note, t0 + i * sx)
            place(buf, note * 0.3, t0 + i * sx + beat * 0.75)  # écho pointé
            i = j
    return buf[:int(bar * bars * SR)]


def kit_fight(buf, t0, beat, b, bars):
    sx = beat / 4
    kicks = {0, 3, 8, 10, 14}
    last = b == bars - 1
    for i in range(16):
        t = t0 + i * sx
        if last and i >= 8:
            place(buf, snare(0.25 + 0.04 * (i - 8)), t)  # roulement de caisse claire
            if i % 4 == 0:
                place(buf, kick(), t)
        else:
            if i in kicks:
                place(buf, kick(), t)
            if i in (4, 12):
                place(buf, snare(0.55), t)
            if i == 15:
                place(buf, snare(0.18), t)
        place(buf, hat(0.15 if i % 2 == 0 else 0.07, open_=(i == 14 and not last)), t)
    if b % 4 == 0:
        place(buf, crash(), t0)


def kit_menu(buf, t0, beat, b, bars):
    sx = beat / 4
    last = b == bars - 1
    for i in range(16):
        t = t0 + i * sx
        if last and i >= 12:
            place(buf, snare(0.3 + 0.08 * (i - 12)), t)
        else:
            if i in (0, 6, 8, 11):
                place(buf, kick(0.75), t)
            if i in (4, 12):
                place(buf, snare(0.5), t)
        if i % 2 == 0:
            place(buf, hat(0.14, open_=(i == 14)), t)
    if b % 4 == 0:
        place(buf, crash(0.18), t0)


def build_music():
    # --- combat : mi mineur, 168 bpm. Em C D B7 / Em C D B7 / Am G C B7 / Am G B7 (+ montée)
    E, C, D, B, Am, G = [64, 67, 71], [60, 64, 67], [62, 66, 69], [59, 63, 66], [57, 60, 64], [55, 59, 62]
    r = {'E': 40, 'C': 36, 'D': 38, 'B': 35, 'A': 33, 'G': 43}
    fight_chords = [(r['E'], E), (r['C'], C), (r['D'], D), (r['B'], B)] * 2 + \
                   [(r['A'], Am), (r['G'], G), (r['C'], C), (r['B'], B), (r['A'], Am), (r['G'], G), (r['B'], B), (r['B'], B)]
    fight_lead = [
        'E5 - . E5 G5 - B5 - A5 - G5 - E5 - . .',
        'G5 - . G5 E5 - C5 - E5 - G5 - C6 - . .',
        'F#5 - . F#5 A5 - D6 - C#6 - A5 - F#5 - . .',
        'D#5 - F#5 - B5 - A5 - F#5 - D#5 - B4 - . .',
        'B5 - . B5 G5 - E5 - G5 - B5 - E6 - D6 -',
        'C6 - B5 - G5 - E5 - G5 - C6 - E6 - . .',
        'D6 - C#6 - A5 - F#5 - A5 - D6 - F#6 - . .',
        'F#6 - D#6 - B5 - D#6 - F#6 - - - . . . .',
        'A5 - . A5 C6 - E6 - D6 - C6 - A5 - . .',
        'G5 - . G5 B5 - D6 - C6 - B5 - G5 - . .',
        'E6 - D6 - C6 - G5 - E5 - G5 - C6 - . .',
        'D#6 - . D#6 F#6 - B6 - A6 - F#6 - D#6 - . .',
        'C6 - E6 - A6 - E6 - C6 - E6 - A6 - . .',
        'B5 - D6 - G6 - D6 - B5 - D6 - G6 - . .',
        'B5 - D#6 - F#6 - B6 - - - - - . . . .',
        'B4 C#5 D#5 E5 F#5 G#5 A#5 B5 C#6 D#6 E6 F#6 G#6 A#6 B6 -',
    ]
    save('music_fight', render_track(168, fight_lead, fight_chords, kit_fight), 0.85)

    # --- menus : la mineur, 144 bpm, plus aérien mais toujours rythmé
    a, f, c, g, e = [57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62], [56, 59, 64]
    menu_chords = [(45, a), (41, f), (48, c), (43, g), (45, a), (41, f), (43, g), (40, e)]
    menu_lead = [
        'E5 - A5 - C6 - B5 A5 - E5 - A5 - . .',
        'F5 - A5 - C6 - A5 F5 - A5 - C6 - . .',
        'E5 - G5 - C6 - G5 E5 - G5 - E6 - . .',
        'D5 - G5 - B5 - D6 B5 - G5 - B5 - . .',
        'A5 - C6 - E6 - C6 A5 - C6 - E6 - . .',
        'A5 - C6 - F6 - E6 C6 - A5 - C6 - . .',
        'B5 - D6 - G6 - F6 D6 - B5 - G5 - . .',
        'G#5 - B5 - E6 - D6 B5 - G#5 - B5 . . .',
    ]
    save('music_menu', render_track(144, menu_lead, menu_chords, kit_menu), 0.85)


def build_jingles():
    # victoire
    d = 2.6
    buf = np.zeros(int(SR * d))
    seq = [(67, 0.0, 0.14), (67, 0.15, 0.14), (67, 0.30, 0.14), (72, 0.45, 0.5), (70, 1.0, 0.3), (72, 1.3, 1.2)]
    for m, t, ln in seq:
        place(buf, lead(hz(m), ln, 0.3, 0.5), t)
        place(buf, bass(hz(m - 24), ln, 0.3), t)
    for m in (60, 64, 67, 72):
        place(buf, arp(hz(m), 1.1, 0.1), 1.3)
    place(buf, kick(), 0.45)
    place(buf, snare(), 0.45)
    place(buf, kick(), 1.3)
    save('music_win', buf)


if __name__ == '__main__':
    build_sfx()
    build_music()
    build_jingles()
    print('ok ->', OUT)
