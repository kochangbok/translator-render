from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path('public/icons')
OUT_DIR.mkdir(parents=True, exist_ok=True)

SIZES = [16, 32, 48, 128]

for size in SIZES:
    img = Image.new('RGBA', (size, size), (9, 105, 218, 255))
    draw = ImageDraw.Draw(img)

    # soft inner gradient-ish blocks
    pad = max(1, size // 10)
    draw.rounded_rectangle((pad, pad, size - pad, size - pad), radius=max(2, size // 6), fill=(255, 255, 255, 28))

    # bilingual stripes
    stripe_h = max(2, size // 10)
    draw.rounded_rectangle((pad * 2, size // 3, size - pad * 2, size // 3 + stripe_h), radius=2, fill=(255, 255, 255, 210))
    draw.rounded_rectangle((pad * 2, size // 3 + stripe_h + max(1, size // 20), size - pad * 2, size // 3 + stripe_h * 2 + max(1, size // 20)), radius=2, fill=(212, 232, 255, 255))

    # KO mark
    try:
        font = ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc', max(8, size // 3))
    except Exception:
        font = ImageFont.load_default()

    text = '한'
    tw, th = draw.textbbox((0, 0), text, font=font)[2:]
    tx = (size - tw) // 2
    ty = max(1, size - th - pad * 2)
    draw.text((tx, ty), text, font=font, fill=(255, 255, 255, 245))

    img.save(OUT_DIR / f'icon-{size}.png')

print('generated:', ', '.join(str(OUT_DIR / f'icon-{s}.png') for s in SIZES))
