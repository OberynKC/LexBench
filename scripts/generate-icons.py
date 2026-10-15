"""生成安装图标：python3 -m pip install Pillow && python3 scripts/generate-icons.py。

使用项目既有的 Lucide Scale 轮廓与品牌色；构建只读取已提交图标，不依赖 Python。
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "build"
OUT.mkdir(exist_ok=True)
SIZE = 2048
image = Image.new("RGBA", (SIZE, SIZE))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((128, 128, 1920, 1920), radius=400, fill="#1e3a5f")

def point(p):
    return (384 + p[0] * (1280 / 24), 384 + p[1] * (1280 / 24))

def line(points):
    points = [point(p) for p in points]
    width = 96
    draw.line(points, fill="#fcd34d", width=width, joint="curve")
    for x, y in points:
        draw.ellipse((x-width/2, y-width/2, x+width/2, y+width/2), fill="#fcd34d")

def bezier(start, c1, c2, end):
    result = []
    for i in range(41):
        t = i / 40
        result.append(tuple((1-t)**3*start[j]+3*(1-t)**2*t*c1[j]+3*(1-t)*t*t*c2[j]+t**3*end[j] for j in (0, 1)))
    return result

for x in (2, 16):
    bowl = [(x, 16), (x+3, 8), (x+6, 16)]
    bowl += bezier((x+6, 16), (x+5.13, 16.65), (x+4.08, 17), (x+3, 17))
    bowl += bezier((x+3, 17), (x+1.92, 17), (x+.87, 16.65), (x, 16))
    line(bowl)
line([(7, 21), (17, 21)])
line([(12, 3), (12, 21)])
beam = [(3, 7), (5, 7)]
beam += bezier((5, 7), (7, 7), (10, 6), (12, 5))
beam += bezier((12, 5), (14, 6), (17, 7), (19, 7))
beam += [(21, 7)]
line(beam)
image = image.resize((1024, 1024), Image.Resampling.LANCZOS)
image.save(OUT / "icon.png")
image.save(OUT / "icon.icns", format="ICNS")
image.save(OUT / "icon.ico", format="ICO", sizes=[(n,n) for n in (16,24,32,48,64,128,256)])
print("已生成 build/icon.png、icon.icns、icon.ico")
