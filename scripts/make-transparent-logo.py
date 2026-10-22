from PIL import Image

src_path = r"e:\projects\AI Projects\Importnest\public\brand\importnest-footer-logo-v10.png"
out_path = r"e:\projects\AI Projects\Importnest\public\brand\importnest-lockup-wordmark-v3.png"

src = Image.open(src_path).convert("RGBA")
w, h = src.size
pad = 40
out = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
px = src.load()
opx = out.load()


def is_plate(r: int, g: int, b: int, a: int) -> bool:
    if a < 8:
        return True
    mx = max(r, g, b)
    if mx <= 28:
        return True
    if mx <= 45 and abs(r - g) < 8 and abs(g - b) < 8:
        return True
    return False


for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if is_plate(r, g, b, a):
            continue
        opx[x + pad, y + pad] = (r, g, b, 255)

# Erase tagline under wordmark only (keep cart icon)
icon_right = int(w * 0.26)
tagline_top = int(h * 0.58)
for y in range(pad + tagline_top, out.size[1]):
    for x in range(pad + icon_right, out.size[0]):
        opx[x, y] = (0, 0, 0, 0)

x0 = pad + int(w * 0.20)
x1 = pad + int(w * 0.32)
y0 = pad + int(h * 0.62)
for y in range(y0, out.size[1]):
    for x in range(x0, x1):
        opx[x, y] = (0, 0, 0, 0)

out.save(out_path, "PNG")
samp = list(out.getdata())
trans = sum(1 for p in samp if p[3] < 10)
black = sum(1 for p in samp if p[3] >= 10 and p[0] <= 28 and p[1] <= 28 and p[2] <= 28)
other = len(samp) - trans - black
print(
    f"saved {out.size[0]}x{out.size[1]} aspect={out.size[0]/out.size[1]:.3f} "
    f"trans={trans} black={black} other={other}"
)
