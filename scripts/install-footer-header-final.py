"""Install new_final sheet for footer lockup + header icon (no wordmark)."""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"
ASSETS = Path(
    r"C:\Users\nazia\.cursor\projects\e-projects-AI-Projects-Importnest\assets"
)
SHEET = next(ASSETS.glob("*new_final-8d277561*.png"))
PLATE = (3, 61, 107)
PAD = 28


def is_plate(r: int, g: int, b: int, tol: int = 45) -> bool:
    return (
        abs(r - PLATE[0]) <= tol
        and abs(g - PLATE[1]) <= tol
        and abs(b - PLATE[2]) <= tol
    )


def is_near_plate(r: int, g: int, b: int) -> bool:
    if is_plate(r, g, b):
        return True
    br = (r + g + b) / 3
    return br < 155 and b > r + 6 and b >= g and r < 115 and b > 40


def is_gold(r: int, g: int, b: int) -> bool:
    return r > 115 and g > 80 and b < 165 and r > b + 18 and r >= g - 15


def is_logo_white(r: int, g: int, b: int) -> bool:
    return r > 205 and g > 205 and b > 205


def is_page_white(r: int, g: int, b: int) -> bool:
    return r >= 244 and g >= 244 and b >= 244


def trim(im: Image.Image, pad: int = 4) -> Image.Image:
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


def add_pad(im: Image.Image, pad: int = PAD) -> Image.Image:
    out = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    out.paste(im, (pad, pad), im)
    return out


def clear_plate_and_rim(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    assert px is not None

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            if is_page_white(r, g, b):
                px[x, y] = (0, 0, 0, 0)
                continue
            if is_gold(r, g, b) or is_logo_white(r, g, b):
                continue
            if is_near_plate(r, g, b):
                px[x, y] = (0, 0, 0, 0)
                continue
            br = (r + g + b) / 3
            sat = max(r, g, b) - min(r, g, b)
            # pale rounded-rect rim
            if br > 100 and sat < 85:
                px[x, y] = (0, 0, 0, 0)

    im = trim(im, pad=4)
    w, h = im.size
    px = im.load()
    assert px is not None
    bb = im.getbbox()
    assert bb
    L, T, R, B = bb
    frame = 20
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 10:
                continue
            on_frame = x < L + frame or x > R - frame - 1 or y < T + frame or y > B - frame - 1
            if not on_frame:
                continue
            if is_gold(r, g, b) or is_logo_white(r, g, b):
                continue
            br = (r + g + b) / 3
            sat = max(r, g, b) - min(r, g, b)
            if br > 95 and sat < 95:
                px[x, y] = (0, 0, 0, 0)

    return add_pad(trim(im, pad=6), pad=PAD)


def extract_icon(lockup: Image.Image) -> Image.Image:
    """Left mark only — gap before IMPORTNEST wordmark."""
    w, h = lockup.size
    y0, y1 = int(h * 0.25), int(h * 0.55)
    gaps: list[int] = []
    for x in range(int(w * 0.12), int(w * 0.45)):
        n = sum(1 for y in range(y0, y1) if lockup.getpixel((x, y))[3] > 30)
        if n <= 2:
            gaps.append(x)
    split = int(w * 0.28)
    if gaps:
        best_s = best_e = cur_s = cur_e = gaps[0]
        for x in gaps[1:]:
            if x == cur_e + 1:
                cur_e = x
            else:
                if cur_e - cur_s > best_e - best_s:
                    best_s, best_e = cur_s, cur_e
                cur_s = cur_e = x
        if cur_e - cur_s > best_e - best_s:
            best_s, best_e = cur_s, cur_e
        split = (best_s + best_e) // 2
    icon = trim(lockup.crop((0, 0, split, h)), pad=4)
    return add_pad(icon, pad=20)


def install() -> None:
    print(f"source: {SHEET.name}")
    footer = clear_plate_and_rim(Image.open(SHEET))
    icon = extract_icon(footer)

    BRAND.mkdir(parents=True, exist_ok=True)
    v4 = BRAND / "importnest-footer-logo-v4.png"
    footer.save(v4, "PNG", optimize=True)
    shutil.copyfile(v4, BRAND / "importnest-footer-logo-v3.png")
    shutil.copyfile(v4, BRAND / "importnest-footer-logo-v2.png")
    shutil.copyfile(v4, BRAND / "importnest-footer-logo.png")

    icon.save(BRAND / "importnest-icon-dark.png", "PNG", optimize=True)
    # Light twin not needed for navy header; keep a copy as icon too
    icon.save(BRAND / "importnest-icon.png", "PNG", optimize=True)

    bb = footer.getbbox()
    assert bb
    l, t, r, b = bb
    print(
        f"footer {footer.size} aspect={footer.width / footer.height:.3f} "
        f"pad L{l}T{t}R{footer.width - r}B{footer.height - b}"
    )
    print(f"icon   {icon.size} aspect={icon.width / max(1, icon.height):.3f}")


if __name__ == "__main__":
    install()
