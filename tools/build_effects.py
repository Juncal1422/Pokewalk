"""Ejecutar desde cualquier carpeta con Python y Pillow tras editar assets/effects."""
import json
import re
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
EFFECTS = ROOT / 'assets/effects'
INDEX = ROOT / 'js/data/effect-atlas.js'
aliases = {'battery_burst': 'battery', 'purple_smite': 'purple',
           'bone_throw/impact': 'bone_impact', 'heal_aura/pieces': 'heal_pieces'}


def frame_files(folder):
    return sorted((p for p in folder.glob('*.png') if p.stem.split('_')[0].isdigit()),
                  key=lambda p: int(p.stem.split('_')[0]))


def join(rows):
    if len({len(row) for row in rows}) != 1:
        raise ValueError(f'Número desigual de fotogramas en {rows[0][0].parent}')
    images = [[Image.open(p).convert('RGBA') for p in row] for row in rows]
    w = max(im.width for row in images for im in row)
    h = max(im.height for row in images for im in row)
    sheet = Image.new('RGBA', (w * len(rows[0]), h * len(rows)))
    for y, row in enumerate(images):
        for x, im in enumerate(row):
            sheet.paste(im, (x*w+(w-im.width)//2, y*h+(h-im.height)//2))
    return sheet, w, h


def build():
    source = INDEX.read_text()
    entries = {}
    comments = {}
    for comment, key, value in re.findall(r'(?:  // ([^\n]+)\n)?  (\w+): (\{[^}]+\})', source):
        entries[key] = json.loads(re.sub(r'(?<=[{,])(\w+):', r'"\1":', value))
        comments[key] = comment
    parts, lines = [], []
    x = y = row_height = 0
    for folder in sorted(p for p in EFFECTS.rglob('*') if p.is_dir() and not p.name.isdigit()):
        path = folder.relative_to(EFFECTS).as_posix()
        key = aliases.get(path, folder.name)
        rows = [frame_files(d) for d in sorted(folder.iterdir()) if d.is_dir() and d.name.isdigit()]
        if not rows and frame_files(folder):
            rows = [frame_files(folder)]
        sheet_path = folder / (folder.name + '.png')
        entry = entries.get(key, {'offsetX': 0, 'offsetY': 0})
        if rows:
            sheet, w, h = join(rows)
            sheet.save(sheet_path)
        else:
            sheet = Image.open(sheet_path).convert('RGBA')
            w, h = (entry['width'], entry['height']) if key in entries else (32, 32)
        if sheet.width % w or sheet.height % h:
            raise ValueError(f'Dimensiones incompatibles en {path}')
        if x + sheet.width > 3072:
            x, y, row_height = 0, y + row_height, 0
        entry.update(x=x, y=y, width=w, height=h, columns=sheet.width//w, rows=sheet.height//h)
        parts.append((x, y, sheet))
        lines.append('  // '+(comments.get(key) or 'Hoja de '+path)+ '\n  '+key+': '+json.dumps(entry)+',\n')
        x += sheet.width
        row_height = max(row_height, sheet.height)
    atlas = Image.new('RGBA', (max(x+im.width for x, y, im in parts), y+row_height))
    for x, y, im in parts:
        atlas.paste(im, (x, y))
    # La paleta exacta reduce la descarga del atlas sin cuantizar el pixel art.
    colors = atlas.getcolors(256)
    if colors:
        palette = [rgba for _, rgba in colors]
        by_color = {int.from_bytes(bytes(rgba), sys.byteorder): i for i, rgba in enumerate(palette)}
        indices = bytes(map(by_color.__getitem__, memoryview(atlas.tobytes()).cast('I')))
        atlas = Image.frombytes('P', atlas.size, indices)
        atlas.putpalette(bytes(value for rgba in palette for value in rgba[:3]))
        atlas.info['transparency'] = bytes(rgba[3] for rgba in palette)
    atlas.save(EFFECTS/'effects.png', optimize=True)
    INDEX.write_text(source.split('export const')[0]+'export const effectSheets = {\n'+''.join(lines)+'};\n')


if __name__ == '__main__':
    build()
