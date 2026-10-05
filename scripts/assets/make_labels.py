"""Turn print-ready label renders into bottle textures matching bottle.glb's UV layout."""
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import os, sys

SP = os.path.dirname(os.path.abspath(__file__))
QL = os.path.join(SP, 'ql')
OUT = sys.argv[1]

# --- 1. Die mask (trim-size) -------------------------------------------------
die = Image.open(os.path.join(QL, 'Moonshiners_DieTrace_.pdf.png')).convert('RGBA')
W, H = die.size
bg = Image.new('RGBA', die.size, (255, 255, 255, 255))
flat = Image.alpha_composite(bg, die).convert('L')
lines = flat.point(lambda v: 255 if v < 230 else 0).filter(ImageFilter.MaxFilter(5))

m = Image.new('L', die.size, 255)
m.paste(128, mask=lines)
for sx, sy in [(0.995, 0.01), (0.995, 0.99), (0.80, 0.99), (0.768, 0.46)]:
    ImageDraw.floodfill(m, (int(sx * W), int(sy * H)), 0)
mask = m.point(lambda v: 0 if v == 0 else 255)
print('die mask coverage %.3f' % (sum(mask.histogram()[255:]) / (W * H)))
mask.save(os.path.join(SP, 'die_mask.png'))

# --- 2. Target placement in the 2274x1008 texture (from existing labels) -----
TEX = (2274, 1008)
BOX = (611, 162, 1656, 847)
bw, bh = BOX[2] - BOX[0], BOX[3] - BOX[1]

# --- 3. Each label: crop bleed -> mask -> place ------------------------------
BLEED_PT, MEDIA_W_PT, MEDIA_H_PT = 8.50394, 532.913, 352.913
LABELS = {
    'Brockbrushes_strawberry_Gin_Print.pdf.png': 'brocksbushes-strawberry-gin.png',
    'Pumpkin_SpicedRum_Print.pdf.png':           'brocksbushes-pumpkin-spiced-rum.png',
    'strawberry_liqueur_Print.pdf.png':          'brocksbushes-strawberry-liqueur.png',
}
os.makedirs(OUT, exist_ok=True)
for src, dst in LABELS.items():
    art = Image.open(os.path.join(QL, src)).convert('RGBA')
    aw, ah = art.size
    bx, by = round(BLEED_PT / MEDIA_W_PT * aw), round(BLEED_PT / MEDIA_H_PT * ah)
    art = art.crop((bx, by, aw - bx, ah - by))
    a = ImageChops.multiply(art.getchannel('A'), mask.resize(art.size, Image.LANCZOS))
    art.putalpha(a)
    tex = Image.new('RGBA', TEX, (0, 0, 0, 0))
    tex.paste(art.resize((bw, bh), Image.LANCZOS), BOX[:2])
    path = os.path.join(OUT, dst)
    tex.save(path, optimize=True)
    print(dst, 'alpha bbox', tex.getchannel('A').getbbox(), '%d KB' % (os.path.getsize(path) // 1024))

# --- 4. Alignment check: new die edge (red) over existing Vamp label ---------
vamp = Image.open(os.path.join(SP, 'Vamp.png')).convert('RGBA')
edge = Image.new('L', TEX, 0)
edge.paste(mask.resize((bw, bh)).filter(ImageFilter.FIND_EDGES), BOX[:2])
red = Image.new('RGBA', TEX, (255, 0, 0, 255))
check = Image.alpha_composite(Image.new('RGBA', TEX, (40, 40, 40, 255)), vamp)
check.paste(red, mask=edge.filter(ImageFilter.MaxFilter(3)))
check.save(os.path.join(SP, 'align_check.png'))
