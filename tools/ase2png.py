#!/usr/bin/env python3
"""Convertit des .aseprite en spritesheet PNG (bande horizontale) + JSON (tags, durées).
Usage: ase2png.py <dossier_drawing> <dossier_sortie>
"""
import json, struct, sys, zlib
from pathlib import Path
from PIL import Image


def parse(path):
    d = Path(path).read_bytes()
    _, magic, nframes, W, H, depth = struct.unpack_from('<IHHHHH', d, 0)
    assert magic == 0xA5E0, path
    trans_idx = d[28]
    off = 128
    layers, tags, palette = [], [], {}
    frames = []  # liste de (durée, {layer: cel})
    for _ in range(nframes):
        fsize, fmagic, old, dur, _r, new = struct.unpack_from('<IHHHHI', d, off)
        nchunks = new if new else old
        p = off + 16
        cels = {}
        for _c in range(nchunks):
            csize, ctype = struct.unpack_from('<IH', d, p)
            body = p + 6
            if ctype == 0x2004:
                flags, ltype, child = struct.unpack_from('<HHH', d, body)
                _bm, opac = struct.unpack_from('<HB', d, body + 10)
                nlen = struct.unpack_from('<H', d, body + 16)[0]
                name = d[body + 18: body + 18 + nlen].decode('utf8', 'replace')
                layers.append(dict(visible=bool(flags & 1), type=ltype, child=child, name=name, opacity=opac))
            elif ctype == 0x2005:
                li, x, y, op, ctp = struct.unpack_from('<HhhBH', d, body)
                q = body + 16
                if ctp == 1:
                    cels[li] = ('link', struct.unpack_from('<H', d, q)[0], op)
                elif ctp in (0, 2):
                    w, h = struct.unpack_from('<HH', d, q)
                    raw = d[q + 4: p + csize]
                    if ctp == 2:
                        raw = zlib.decompress(raw)
                    cels[li] = ('img', x, y, w, h, raw, op)
            elif ctype == 0x2018:
                n = struct.unpack_from('<H', d, body)[0]
                q = body + 10
                for _t in range(n):
                    f0, f1, direction = struct.unpack_from('<HHB', d, q)
                    q += 17
                    nl = struct.unpack_from('<H', d, q)[0]
                    tags.append(dict(name=d[q + 2:q + 2 + nl].decode('utf8'), from_=f0, to=f1, dir=direction))
                    q += 2 + nl
            elif ctype == 0x2019:
                size, f0, f1 = struct.unpack_from('<III', d, body)
                q = body + 20
                for i in range(f0, f1 + 1):
                    fl = struct.unpack_from('<H', d, q)[0]
                    palette[i] = tuple(d[q + 2:q + 6])
                    q += 6
                    if fl & 1:
                        nl = struct.unpack_from('<H', d, q)[0]
                        q += 2 + nl
            p += csize
        frames.append((dur, cels))
        off += fsize
    return W, H, depth, trans_idx, layers, tags, palette, frames


def to_rgba(raw, w, h, depth, palette, trans_idx):
    if depth == 32:
        return Image.frombytes('RGBA', (w, h), raw)
    out = bytearray()
    if depth == 16:
        for i in range(0, w * h * 2, 2):
            out += bytes((raw[i], raw[i], raw[i], raw[i + 1]))
    else:
        for b in raw[:w * h]:
            if b == trans_idx:
                out += b'\0\0\0\0'
            else:
                out += bytes(palette.get(b, (0, 0, 0, 255)))
    return Image.frombytes('RGBA', (w, h), bytes(out))


def layer_visible(layers, i):
    if not layers[i]['visible']:
        return False
    lvl = layers[i]['child']
    for j in range(i - 1, -1, -1):
        if layers[j]['child'] < lvl:
            if not layers[j]['visible']:
                return False
            lvl = layers[j]['child']
    return True


def render(path, show_hidden=False):
    W, H, depth, ti, layers, tags, pal, frames = parse(path)
    imgs = []
    for fi, (dur, cels) in enumerate(frames):
        canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for li in sorted(cels):
            if li >= len(layers) or layers[li]['type'] != 0 or not (show_hidden or layer_visible(layers, li)):
                continue
            c = cels[li]
            if c[0] == 'link':
                src = frames[c[1]][1].get(li)
                if not src or src[0] != 'img':
                    continue
                c = src
            _, x, y, w, h, raw, op = c
            im = to_rgba(raw, w, h, depth, pal, ti)
            a = op * layers[li]['opacity'] // 255
            if a < 255:
                alpha = im.getchannel('A').point(lambda v: v * a // 255)
                im.putalpha(alpha)
            layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            layer.paste(im, (x, y))
            canvas = Image.alpha_composite(canvas, layer)
        imgs.append(canvas)
    return W, H, imgs, [f[0] for f in frames], tags


def main():
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    dst.mkdir(parents=True, exist_ok=True)
    index = {}
    for f in sorted(src.rglob('*.aseprite')):
        W, H, imgs, durs, tags = render(f)
        sheet = Image.new('RGBA', (W * len(imgs), H), (0, 0, 0, 0))
        for i, im in enumerate(imgs):
            sheet.paste(im, (i * W, 0))
        name = f.stem.replace('é', 'e')
        sheet.save(dst / f'{name}.png')
        meta = dict(w=W, h=H, frames=len(imgs), durations=durs, tags=tags)
        (dst / f'{name}.json').write_text(json.dumps(meta, ensure_ascii=False))
        index[name] = meta
        print(name, W, H, len(imgs), [t['name'] for t in tags])
    (dst / 'index.json').write_text(json.dumps(index, ensure_ascii=False))


if __name__ == '__main__':
    main()
