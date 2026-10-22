"""Install footer lockup from new_final dark sheet (white IMPORT on navy plate)."""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"
ASSETS = Path(
    r"C:\Users\nazia\.cursor\projects\e-projects-AI-Projects-Importnest\assets"
)
SHEET = next(ASSETS.glob("*new_final-3da76201*.png"))
PLATE = (3, 61, 107)
PAD = 24


def is_plate(r: int, g: int, b: int, tol: int = 38) -> bool:
    return (
        abs(r - PLATE[0]) <= tol
        and abs(g - PLATE[1]) <= tol
        and abs(b - PLATE[2]) <= tol
    )


def is_near_navy_plate(r: int, g: int, b: int) -> bool:
    if is_plate(r, g, b, tol=42):
        return True
    br = (r + g + b) / 3
    # Soft plate / POR counter fills
    if br < 145 and b > r + 10 and b >= g and r < 100 and b > 50:
        return True
    return False


def is_gold(r: int, g: int, b: int) -> bool:
    return r > 120 and g > 85 and b < 160 and r > b + 20 and r >= g - 10


def is_white_ink(r: int, g: int, b: int) -> bool:
    return r > 200 and g > 200 and b > 200


def is_white_margin(r: int, g: int, b: int) -> bool:
    return r >= 245 and g >= 245 and b >= 245


def trim(im: Image.Image, pad: int = 6) -> Image.Image:
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

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            if is_white_margin(r, g, b):
                px[x, y] = (0, 0, 0, 0)
                continue
            if is_gold(r, g, b) or is_white_ink(r, g, b):
                continue
            # Keep very dark nest / bag details that aren't plate-blue
            br = (r + g + b) / 3
            if br < 40 and not (b > r + 15 and b > 40):
                continue
            if is_near_navy_plate(r, g, b):
                px[x, y] = (0, 0, 0, 0)

    # Drop faint pale edge arcs left on outer columns after plate removal
    out = trim(im, pad=4)
    w, h = out.size
    px = out.load()
    assert px is not None
    band = max(8, int(w * 0.02))
    for x in list(range(0, band)) + list(range(w - band, w)):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a < 12:
                continue
            if is_gold(r, g, b) or is_white_ink(r, g, b):
                continue
            br = (r + g + b) / 3
            sat = max(r, g, b) - min(r, g, b)
            if br > 100 and sat < 55:
                px[x, y] = (0, 0, 0, 0)

    return add_padding(trim(out, pad=8), pad=PAD)


def install() -> float:
    print(f"source: {SHEET.name}")
    out = process(Image.open(SHEET))
    BRAND.mkdir(parents=True, exist_ok=True)
    v3 = BRAND / "importnest-footer-logo-v3.png"
    out.save(v3, "PNG", optimize=True)
    shutil.copyfile(v3, BRAND / "importnest-footer-logo-v2.png")
    shutil.copyfile(v3, BRAND / "importnest-footer-logo.png")
    bb = out.getbbox()
    assert bb
    l, t, r, b = bb
    aspect = out.width / max(1, out.height)
    print(
        f"footer {out.size} aspect={aspect:.3f} "
        f"pad L{l}T{t}R{out.width - r}B{out.height - b}"
    )
    return aspect


if __name__ == "__main__":
    install()
