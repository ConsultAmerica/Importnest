"""Rebuild footer i+nest lockup with generous padding (no crop).

Uses the white-IMPORT sheet for navy footer.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"
ASSETS = Path(
    r"C:\Users\nazia\.cursor\projects\e-projects-AI-Projects-Importnest\assets"
)
# Prefer latest white-IMPORT sheet; fall back to earlier footer source
SHEETS = list(ASSETS.glob("*image-caa1d87f*.png")) + list(
    ASSETS.glob("*image-d804803c*.png")
)
SHEET = SHEETS[0]
PLATE = (5, 63, 113)
PAD = 20
SCALE = 2  # upscale before pad for crisp display


def is_plate(r: int, g: int, b: int, tol: int = 36) -> bool:
    return (
        abs(r - PLATE[0]) <= tol
        and abs(g - PLATE[1]) <= tol
        and abs(b - PLATE[2]) <= tol
    )


def is_gold(r: int, g: int, b: int) -> bool:
    return r > 110 and g > 70 and b < 155 and r > b + 15 and r >= g - 10


def is_white_ink(r: int, g: int, b: int) -> bool:
    return r > 185 and g > 185 and b > 185


def is_edge_artifact(r: int, g: int, b: int) -> bool:
    if is_gold(r, g, b) or is_white_ink(r, g, b):
        return False
    br = (r + g + b) / 3
    if br < 90:
        return False
    sat = max(r, g, b) - min(r, g, b)
    if sat < 60 and br > 100:
        return True
    if b >= g >= r and br > 105 and sat < 95 and r < 200:
        return True
    return False


def is_counter_navy(r: int, g: int, b: int) -> bool:
    if is_gold(r, g, b) or is_white_ink(r, g, b):
        return False
    if is_plate(r, g, b, tol=40):
        return True
    br = (r + g + b) / 3
    sat = max(r, g, b) - min(r, g, b)
    if br < 160 and b > r + 6 and b >= g and r < 130 and sat > 10:
        return True
    return False


def trim(im: Image.Image, pad: int = 8) -> Image.Image:
    bb = im.getbbox()
    if not bb:
        return im
    l, t, r, b = bb
    return im.crop(
        (
            max(0, l - pad),
            max(0, t - pad),
            min(im.width, r + pad),
            min(im.height, b + pad),
        )
    )


def add_padding(im: Image.Image, pad: int = PAD) -> Image.Image:
    out = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    out.paste(im, (pad, pad), im)
    return out


def process(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    assert px is not None
    wordmark_x = int(w * 0.30)
    left_scan = max(8, int(w * 0.035))
    right_scan = w - max(8, int(w * 0.04))

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            if (x <= left_scan or x >= right_scan) and (
                is_edge_artifact(r, g, b) or is_plate(r, g, b, tol=45)
            ):
                px[x, y] = (0, 0, 0, 0)
                continue
            if x <= int(w * 0.015) or x >= int(w * 0.985):
                br = (r + g + b) / 3
                if br > 95 and not is_gold(r, g, b) and not is_white_ink(r, g, b):
                    px[x, y] = (0, 0, 0, 0)
                    continue
            if is_gold(r, g, b) or is_white_ink(r, g, b):
                continue
            br = (r + g + b) / 3
            if x < wordmark_x and br < 55 and b > 25:
                continue  # tag disc
            if is_counter_navy(r, g, b) or is_plate(r, g, b):
                px[x, y] = (0, 0, 0, 0)

    out = trim(im, pad=10)
    # Upscale for crisp footer rendering, then pad so CSS never clips edges
    out = out.resize(
        (out.width * SCALE, out.height * SCALE),
        Image.Resampling.LANCZOS,
    )
    return add_padding(out, pad=PAD)


def install() -> float:
    print(f"source: {SHEET.name}")
    out = process(Image.open(SHEET))
    BRAND.mkdir(parents=True, exist_ok=True)
    path = BRAND / "importnest-footer-logo.png"
    out.save(path, "PNG", optimize=True)
    aspect = out.width / max(1, out.height)
    bb = out.getbbox()
    assert bb
    l, t, r, b = bb
    print(
        f"footer {out.size} aspect={aspect:.3f} "
        f"pad L{l}T{t}R{out.width - r}B{out.height - b}"
    )
    return aspect


if __name__ == "__main__":
    install()
