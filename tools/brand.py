"""Draw EERA's icon, splash and store artwork (book-spine stripe, serif letter, yellow 'underline' bar)."""
from PIL import Image, ImageDraw, ImageFont
SERIF = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BG, SPINE, INK, HL, DARK = (19, 36, 46), (42, 66, 80), (255, 255, 255), (255, 210, 63), (11, 12, 15)

def mark(d, cx, cy, size, text='E'):
    f = ImageFont.truetype(SERIF, size)
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    w, h = r - l, b - t
    x, y = cx - w / 2 - l, cy - h / 2 - t - size * 0.06
    d.text((x, y), text, font=f, fill=INK)
    bw, bh = max(w * 1.15, size * 0.62), size * 0.085
    top = cy + h / 2 + size * 0.02
    d.rounded_rectangle((cx - bw / 2, top, cx + bw / 2, top + bh), radius=bh * 0.3, fill=HL)

def icon(n, spine=True, safe=1.0):
    im = Image.new('RGB', (n, n), BG); d = ImageDraw.Draw(im)
    if spine: d.rectangle((0, 0, round(n * 0.0156), n), fill=SPINE)
    mark(d, n / 2, n / 2, n * 0.56 * safe)
    return im

def fg(n):
    im = Image.new('RGBA', (n, n), (0, 0, 0, 0)); mark(ImageDraw.Draw(im), n / 2, n / 2, n * 0.36); return im

def splash(n):
    im = Image.new('RGB', (n, n), DARK); mark(ImageDraw.Draw(im), n / 2, n / 2, n * 0.06, 'EERA'); return im

def feature():
    im = Image.new('RGB', (1024, 500), DARK); d = ImageDraw.Draw(im)
    f = ImageFont.truetype(SERIF, 110); d.text((60, 120), 'EERA', font=f, fill=INK)
    l, t, r, b = d.textbbox((60, 120), 'EERA', font=f)
    d.rounded_rectangle((60, b + 14, r, b + 30), radius=5, fill=HL)
    s = ImageFont.truetype(SANS, 30)
    d.text((62, b + 56), 'Big ideas from great books,', font=s, fill=(225, 228, 234))
    d.text((62, b + 96), 'one swipe at a time.', font=s, fill=(225, 228, 234))
    cols = [(32, 42, 107), (107, 31, 51), (14, 98, 104), (122, 76, 18), (31, 77, 58), (92, 35, 64), (122, 46, 20)]
    for i, c in enumerate(cols):
        x = 590 + i * 58
        d.rectangle((x, 60, x + 48, 440), fill=c); d.rectangle((x, 60, x + 6, 440), fill=(255, 255, 255))
    return im

if __name__ == '__main__':
    icon(1024).save('assets/icon-only.png'); fg(1024).save('assets/icon-foreground.png')
    Image.new('RGB', (1024, 1024), BG).save('assets/icon-background.png')
    splash(2732).save('assets/splash.png'); splash(2732).save('assets/splash-dark.png')
    icon(1024).save('store/app-store-icon-1024.png'); icon(512).save('store/play-icon-512.png')
    feature().save('store/play-feature-graphic-1024x500.png')
    icon(180).save('icons/apple-touch-icon.png'); icon(192).save('icons/icon-192.png'); icon(512).save('icons/icon-512.png')
    icon(512, spine=False, safe=0.78).save('icons/maskable-512.png')
    print('artwork done')
