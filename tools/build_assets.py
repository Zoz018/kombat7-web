#!/usr/bin/env python3
"""Génère public/assets/ à partir de drawing/*.aseprite.
Usage: python3 tools/build_assets.py   (depuis la racine du projet)
"""
import json, math, sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from ase2png import render  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'drawing'
OUT = ROOT / 'public' / 'assets'
OUT.mkdir(parents=True, exist_ok=True)

CHARS = ['Sami', 'Matthis', 'Leo', 'Julien', 'Enzo']
MAX_W = 4096


def union_bbox(imgs):
    boxes = [b for b in (im.getbbox() for im in imgs) if b]
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


def build_character(name):
    W, H, imgs, durs, tags = render(SRC / 'Characters' / f'{name}.aseprite', show_hidden=True)  # projectiles dans des calques masqués
    ib = imgs[0].getbbox()  # frame 0 = Idle
    ax = (ib[0] + ib[2]) / 2
    ay = ib[3]
    # taille du corps = bbox cumulée des frames Idle
    body = union_bbox([imgs[i] for i in range(tags[0]['from_'], tags[0]['to'] + 1)])
    # étendue gauche/droite de chaque frame par rapport à l'ancre (pour les hitboxes)
    ext = []
    for im in imgs:
        b = im.getbbox()
        ext.append([0, 0] if not b else [max(0, round(ax - b[0])), max(0, round(b[2] - ax))])
    atk = [i for t in tags if t['name'] in ('Jab', 'Special') for i in range(t['from_'], t['to'] + 1)]
    face_right = sum(ext[i][1] - ext[i][0] for i in atk) > 0
    x0, y0, x1, y1 = union_bbox(imgs)
    # on garde le crop symétrique autour de l'ancre pour pouvoir flip sans décalage
    half = int(math.ceil(max(ax - x0, x1 - ax))) + 2
    x0, x1 = int(ax - half), int(ax + half)
    y1 = int(max(y1, ay)) + 2
    fw, fh = x1 - x0, y1 - y0
    cols = max(1, MAX_W // fw)
    rows = math.ceil(len(imgs) / cols)
    sheet = Image.new('RGBA', (cols * fw, rows * fh), (0, 0, 0, 0))
    for i, im in enumerate(imgs):
        crop = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
        crop.paste(im.crop((max(x0, 0), y0, min(x1, W), y1)), (max(0, -x0), 0))
        sheet.paste(crop, ((i % cols) * fw, (i // cols) * fh))
    sheet.save(OUT / f'char_{name}.png')
    meta = dict(
        fw=fw, fh=fh, frames=len(imgs),
        # ancre (pieds, centre) dans la frame rognée
        ax=ax - x0, ay=ay - y0,
        bodyW=body[2] - body[0], bodyH=body[3] - body[1],
        durations=durs,
        faceRight=face_right,
        ext=ext,
        tags={t['name']: [t['from_'], t['to']] for t in tags},
    )
    return meta


def build_background():
    sel = Image.open(OUT / '_sel.png').convert('RGBA')
    return sel


def main():
    meta = {}
    for c in CHARS:
        meta[c] = build_character(c)
        print(c, meta[c]['fw'], meta[c]['fh'], meta[c]['frames'], 'frames', 'body', meta[c]['bodyW'], meta[c]['bodyH'])

    for name, src in [('start', 'Others/Start_Screen'), ('versus', 'Others/Versus_Screen'),
                      ('life', 'Others/Life'), ('card_1p', 'Cards/1P_Card'), ('card_2p', 'Cards/2P_Card'),
                      ('studio', 'Others/Studio_Grenouille')]:
        W, H, imgs, durs, tags = render(SRC / f'{src}.aseprite')
        sheet = Image.new('RGBA', (W * len(imgs), H), (0, 0, 0, 0))
        for i, im in enumerate(imgs):
            sheet.paste(im, (i * W, 0))
        sheet.save(OUT / f'{name}.png')
        meta[f'_{name}'] = dict(w=W, h=H, frames=len(imgs), durations=durs)

    # Le "VS" de l'écran Versus, détouré (noir + dégradé orange) pour le réutiliser avec n'importe quel duo
    v = Image.open(OUT / 'versus.png').convert('RGBA')
    vp = v.load()
    glyph = Image.new('RGBA', v.size, (0, 0, 0, 0))
    gp = glyph.load()
    for y in range(10, 60):
        for x in range(95, 162):
            r, g, b, a = vp[x, y]
            if (r < 60 and g < 60 and b < 90) or (r > 235 and g > 85):
                gp[x, y] = (r, g, b, 255)
    glyph.crop(glyph.getbbox()).save(OUT / 'vs_glyph.png')

    # Fond de l'écran Versus : ton dessin sans Enzo/Sami (le dégradé est horizontal -> on recopie la rangée du haut)
    bgv = Image.new('RGBA', v.size, (0, 0, 0, 255))
    bp = bgv.load()
    for y in range(v.height):
        split = 133.5 - 14.0 * y / (v.height - 1)
        for x in range(v.width):
            if abs(x - split) <= 1:
                bp[x, y] = (0, 0, 0, 255)
            elif x < split:
                bp[x, y] = vp[min(x, 132), 0]
            else:
                bp[x, y] = vp[max(x, 136), 0]
    bgv.save(OUT / 'versus_bg.png')

    for c in CHARS:
        W, H, imgs, _, _ = render(SRC / 'Cards' / f'{c}_Card.aseprite')
        imgs[0].save(OUT / f'card_{c}.png')

    # Écran de sélection : fond + cartes recollées par-dessus (efface les cadres 1P/2P dessinés dans le fond)
    # Drapeaux (drawing/Flags/Flag_<pays>.aseprite) -> flag_<perso>.png
    flags = {'Enzo': 'France', 'Matthis': 'Corsica', 'Sami': 'Maroc', 'Julien': 'USA', 'Leo': 'Chile'}
    meta['_flags'] = {}
    for c, country in flags.items():
        fw_, fh_, fimgs, _, _ = render(SRC / 'Flags' / f'Flag_{country}.aseprite')
        fimgs[0].save(OUT / f'flag_{c}.png')
        meta['_flags'][c] = [fw_, fh_]

    W, H, imgs, _, _ = render(SRC / 'Others' / 'Selection_Card.aseprite')
    bg = imgs[0]
    layout = {'Enzo': (0, 0), 'Leo': (1, 0), 'Matthis': (2, 0), 'Sami': (0, 1), 'Julien': (1, 1)}
    X0, Y0, S = 357, 320, 96
    from PIL import ImageDraw
    draw = ImageDraw.Draw(bg)
    for c, (i, j) in layout.items():
        cx, cy = X0 + i * S, Y0 + j * S
        card = Image.open(OUT / f'card_{c}.png').convert('RGBA').resize((S, S), Image.NEAREST)
        cell = Image.new('RGBA', (S, S), (0, 105, 170, 255))  # bleu océan de la grille
        cell.alpha_composite(card)
        bg.paste(cell, (cx, cy))
        draw.rectangle((cx, cy, cx + S - 1, cy + S - 1), outline=(1, 0, 0, 255), width=3)
    # case "?" : on retire le cadre bleu qui était dessiné dessus (aucun en réalité) -> on laisse tel quel
    # cadres latéraux 1P / 2P (là où s'affichera le perso choisi)
    bg.save(OUT / 'select_bg.png')

    layout_meta = {
        'cellX0': X0, 'cellY0': Y0, 'cell': S,
        'grid': [['Enzo', 'Leo', 'Matthis'], ['Sami', 'Julien', 'RANDOM']],
        'portrait1': [233, 367, 96, 96], 'portrait2': [677, 367, 96, 96],
        'size': [W, H],
    }
    meta['_select'] = layout_meta
    (OUT / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    print('ok ->', OUT)


if __name__ == '__main__':
    main()
