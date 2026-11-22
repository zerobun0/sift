# Draws the Sift mark as PNGs (Chromium needs PNG; Firefox/Zen uses the SVG). Run: python scripts/icons.py
from PIL import Image, ImageDraw
from pathlib import Path
out = Path(__file__).resolve().parent.parent / 'src' / 'icons'
def mark(size):
    s = 8; S = 64 * s
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=16 * s, fill='#211d18')
    def grain(x, y, fill='#f3ede2'):
        d.ellipse([x * s, y * s, (x + 8.5) * s, (y + 8.5) * s], fill=fill)
    for x in (10, 21.5, 34, 45.5): grain(x, 14)
    for x in (21.5, 34): grain(x, 28)
    d.ellipse([26.75 * s, 41 * s, 37.25 * s, 51.5 * s], fill='#f0a13a')
    return im.resize((size, size), Image.LANCZOS)
for n in (16, 32, 48, 96, 128):
    mark(n).save(out / f'icon-{n}.png')
print('ok')
