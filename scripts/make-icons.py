"""生成 PWA 图标：赭红圆角方块 + 白色「日」（明朝体）"""
from PIL import Image, ImageDraw, ImageFont

ACCENT = (176, 68, 44, 255)      # #b0442c
WHITE = (255, 253, 249, 255)
FONT = r'C:\Windows\Fonts\yumindb.ttf'   # Yu Mincho Demibold


def rounded(size, radius, bg):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=bg)
    return img


def glyph(img, size, ratio, color=WHITE):
    d = ImageDraw.Draw(img)
    fs = int(size * ratio)
    font = ImageFont.truetype(FONT, fs)
    ch = '日'
    box = d.textbbox((0, 0), ch, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    x = (size - w) / 2 - box[0]
    y = (size - h) / 2 - box[1]
    # 明朝体的「日」重心偏高，往下压一点更稳
    d.text((x, y + size * 0.015), ch, font=font, fill=color)
    return img


def save(img, name):
    img.save(name)
    print('->', name, img.size)


# 普通图标：圆角 + 透明的四角
for size in (192, 512):
    im = rounded(size, int(size * 0.22), ACCENT)
    glyph(im, size, 0.56)
    save(im, f'assets/icons/icon-{size}.png')

# maskable：整块铺满（安卓会自己裁形状），字形缩到安全区
for size in (512,):
    im = Image.new('RGBA', (size, size), ACCENT)
    glyph(im, size, 0.42)
    save(im, f'assets/icons/icon-maskable-{size}.png')
