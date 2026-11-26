"""Draw EERA's icon, splash and store artwork from brand/eera-face.svg (needs rsvg-convert + Pillow)."""
import io, re, subprocess
from PIL import Image, ImageDraw, ImageFont
BURGUNDY, NAVY, IVORY, GOLD, DARK = '#6b1f33', (19, 36, 46), (245, 239, 226), (232, 184, 74), (11, 12, 15)
SERIF = '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'
SERIF_B = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FACE = re.search(r'<g id="eera">.*</g>', open('brand/eera-face.svg').read(), re.S).group(0)
TAG = "She reads so you don't have to."

def svg(n, scale=1.0, bg=BURGUNDY, dy=0):
    s = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="{n}" height="{n}">
    {'<rect width="1024" height="1024" fill="%s"/>' % bg if bg else ''}
    <g transform="translate({512 - 512 * scale} {512 - 512 * scale + dy}) scale({scale})">{FACE}</g></svg>'''
    png = subprocess.run(['rsvg-convert', '-w', str(n), '-h', str(n)], input=s.encode(), capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(png)).convert('RGBA')

def icon(n, safe=1.0):
    return svg(n, 1.22 * safe, dy=-28 * safe).convert('RGB')   # zoomed so the face reads at home-screen size; blazer runs off the bottom

def splash(n):
    im = Image.new('RGB', (n, n), DARK); face = svg(int(n * 0.30), 1.0)
    m = Image.new('L', face.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, *face.size), radius=face.size[0] // 4.5, fill=255)
    im.paste(face, ((n - face.size[0]) // 2, int(n * 0.26)), m)
    d = ImageDraw.Draw(im); f = ImageFont.truetype(SERIF_B, int(n * 0.05)); t = ImageFont.truetype(SANS, int(n * 0.016))
    y = int(n * 0.26) + face.size[1] + int(n * 0.03)
    d.text((n / 2, y), 'EERA', font=f, fill=IVORY, anchor='mt')
    d.text((n / 2, y + int(n * 0.075)), TAG, font=t, fill=(200, 196, 188), anchor='mt')
    return im

def feature():
    im = Image.new('RGB', (1024, 500), DARK); d = ImageDraw.Draw(im)
    face = svg(380, 1.0); m = Image.new('L', face.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, 380, 380), radius=84, fill=255)
    im.paste(face, (600, 60), m)
    d.text((60, 130), 'EERA', font=ImageFont.truetype(SERIF_B, 110), fill=IVORY)
    d.rounded_rectangle((62, 262, 360, 272), radius=4, fill=GOLD)
    s = ImageFont.truetype(SANS, 30)
    d.text((62, 300), TAG, font=s, fill=(225, 228, 234))
    d.text((62, 344), 'Big ideas from great books, one swipe at a time.', font=ImageFont.truetype(SANS, 21), fill=(170, 174, 182))
    return im

if __name__ == '__main__':
    icon(1024).save('assets/icon-only.png')
    svg(1024, 0.62, bg=None).save('assets/icon-foreground.png')      # Android adaptive icon: keep inside the safe circle
    Image.new('RGB', (1024, 1024), BURGUNDY).save('assets/icon-background.png')
    splash(2732).save('assets/splash.png'); splash(2732).save('assets/splash-dark.png')
    icon(1024).save('store/app-store-icon-1024.png'); icon(512).save('store/play-icon-512.png')
    feature().save('store/play-feature-graphic-1024x500.png')
    icon(180).save('icons/apple-touch-icon.png'); icon(192).save('icons/icon-192.png'); icon(512).save('icons/icon-512.png')
    svg(512, 0.78).convert('RGB').save('icons/maskable-512.png')
    print('artwork done')
