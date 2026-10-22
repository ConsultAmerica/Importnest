"""Rebuild header (bags) + footer (i+nest) cleanly — no content cropping.

- Strip plate / pale crop-mark arcs BEFORE trim (only on plate pixels)
- Compose compact header (full nest, no tagline) + dark twin for navy header
- Footer: white IMPORT i+nest with POR counters cleared
- Generous transparent padding; smaller display sizes via CSS elsewhere
"""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"
ASSETS = Path(
    r"C:\Users\nazia\.cursor\projects\e-projects-AI-Projects-Importnest\assets"
)
HEADER_SHEET = next(ASSETS.glob("*new_logo-b2797dd1*.png"))
FOOTER_SHEET = next(ASSETS.glob("*image-caa1d87f*.png"))
PAD = 30


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


def add_padding(im: Image.Image, pad: int = PAD) -> Image.Image:
    out = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    out.paste(im, (pad, pad), im)
    return out


def white_to_transparent(im: Image.Image, thresh: int = 246) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    assert px is not None
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r >= thresh and g >= thresh and b >= thresh:
                px[x, y] = (r, g, b, 0)
            elif (r + g + b) / 3 >= 242 and max(r, g, b) - min(r, g, b) <= 10:
                px[x, y] = (r, g, b, 0)
    return im


def is_navy_ink(r: int, g: int, b: int) -> bool:
    br = (r + g + b) / 3
    if br > 105:
        return False
    if r > 110 and g > 70 and b < 120 and r > b + 20:
        return False
    if r > 200 and g > 200 and b > 200:
        return False
    if b >= r and b >= g and b > 30 and br < 100:
        return True
    if r < 55 and g < 75 and 35 < b < 140:
        return True
    return False


def navy_to_white(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    assert px is not None
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            if is_navy_ink(r, g, b):
                br = max(0.6, min(1.0, (r + g + b) / 160))
                v = int(235 + 20 * br)
                px[x, y] = (v, v, v, a)
    return im


def wipe_plate_edge_arcs(im: Image.Image, plate_like) -> Image.Image:
    """Remove pale vertical arcs that sit on the plate, not on logo ink."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    assert px is not None
    band = max(12, int(w * 0.04))
    for x in list(range(0, band)) + list(range(w - band, w)):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            if plate_like(r, g, b):
                px[x, y] = (0, 0, 0, 0)
                continue
            br = (r + g + b) / 3
            sat = max(r, g, b) - min(r, g, b)
            # pale cyan/gray crop marks only
            if br > 100 and sat < 55 and r < 220:
                px[x, y] = (0, 0, 0, 0)
    return im


def wordmark_bottom(im: Image.Image) -> int:
    w, h = im.size
    dens: list[tuple[int, int]] = []
    for y in range(int(h * 0.15), int(h * 0.85)):
        n = sum(
            1
            for x in range(int(w * 0.30), w, 2)
            if im.getpixel((x, y))[3] > 25
        )
        dens.append((y, n))
    peak = max((d for _, d in dens), default=0)
    thr = max(20, int(peak * 0.35))
    bottom = int(h * 0.4)
    seen = False
    for y, d in dens:
        if d >= thr:
            seen = True
            bottom = y
        elif seen and d < thr * 0.25:
            break
    return bottom


def find_gap(im: Image.Image) -> int:
    w, h = im.size
    y0, y1 = int(h * 0.38), int(h * 0.58)
    gaps: list[int] = []
    for x in range(int(w * 0.16), int(w * 0.48)):
        n = sum(1 for y in range(y0, y1) if im.getpixel((x, y))[3] > 25)
        if n <= 2:
            gaps.append(x)
    if not gaps:
        return int(w * 0.30)
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
    return (best_s + best_e) // 2


def remove_tagline(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    assert px is not None
    wm_b = wordmark_bottom(im)
    tag_start = min(h - 1, wm_b + 8)
    split = find_gap(im)
    for y in range(tag_start, h):
        for x in range(split, w):
            px[x, y] = (0, 0, 0, 0)
    return im


def compose_compact(im: Image.Image, word_h: int = 80, gap: int = 16) -> Image.Image:
    cleaned = remove_tagline(im.copy())
    split = find_gap(im)
    icon = trim(cleaned.crop((0, 0, max(8, split - 2), cleaned.height)), pad=3)

    wm_b = wordmark_bottom(cleaned)
    # wordmark bbox
    top, bottom, left, right = cleaned.height, 0, cleaned.width, 0
    for y in range(0, min(cleaned.height, wm_b + 4)):
        for x in range(split, cleaned.width):
            if cleaned.getpixel((x, y))[3] > 25:
                top = min(top, y)
                bottom = max(bottom, y)
                left = min(left, x)
                right = max(right, x)
    word = cleaned.crop((left, top, right + 1, bottom + 1))

    scale_w = word_h / max(1, word.height)
    word_r = word.resize(
        (max(1, int(word.width * scale_w)), word_h), Image.Resampling.LANCZOS
    )
    icon_h = int(word_h * 1.32)
    scale_i = icon_h / max(1, icon.height)
    icon_r = icon.resize(
        (max(1, int(icon.width * scale_i)), icon_h), Image.Resampling.LANCZOS
    )

    canvas_h = max(icon_r.height, word_r.height)
    canvas_w = icon_r.width + gap + word_r.width
    out = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    out.paste(icon_r, (0, (canvas_h - icon_r.height) // 2), icon_r)
    out.paste(word_r, (icon_r.width + gap, (canvas_h - word_r.height) // 2), word_r)
    return add_padding(out, pad=PAD)


# ---- footer (navy plate) ----
PLATE = (5, 63, 113)


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


def process_footer(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    assert px is not None
    word_x = int(w * 0.30)

    # First pass: plate + edge arcs on plate only
    band = max(10, int(w * 0.04))
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            on_edge = x < band or x >= w - band
            if is_plate(r, g, b, tol=40):
                px[x, y] = (0, 0, 0, 0)
                continue
            if on_edge:
                br = (r + g + b) / 3
                sat = max(r, g, b) - min(r, g, b)
                if br > 100 and sat < 60 and not is_gold(r, g, b) and not is_white_ink(
                    r, g, b
                ):
                    px[x, y] = (0, 0, 0, 0)
                    continue
            if is_gold(r, g, b) or is_white_ink(r, g, b):
                continue
            br = (r + g + b) / 3
            if x < word_x and br < 55 and b > 25:
                continue  # tag
            # POR counters / soft navy
            if x >= word_x and br < 160 and b > r + 6 and b >= g and r < 130:
                px[x, y] = (0, 0, 0, 0)

    out = trim(im, pad=8)
    out = out.resize((out.width * 2, out.height * 2), Image.Resampling.LANCZOS)
    return add_padding(out, pad=PAD)


def install() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)

    # Header from bags sheet
    light_full = trim(
        wipe_plate_edge_arcs(
            white_to_transparent(Image.open(HEADER_SHEET)),
            lambda r, g, b: r > 240 and g > 240 and b > 240,
        )
    )
    dark_full = trim(navy_to_white(light_full.copy()))

    header = compose_compact(light_full)
    header_dark = compose_compact(dark_full)
    light = add_padding(light_full)
    dark = add_padding(dark_full)

    header.save(BRAND / "importnest-header-logo-v4.png", "PNG", optimize=True)
    header_dark.save(BRAND / "importnest-header-logo-v4-dark.png", "PNG", optimize=True)
    shutil.copyfile(BRAND / "importnest-header-logo-v4.png", BRAND / "importnest-header-logo-v3.png")
    shutil.copyfile(BRAND / "importnest-header-logo-v4.png", BRAND / "importnest-header-logo-v2.png")
    shutil.copyfile(
        BRAND / "importnest-header-logo-v4-dark.png",
        BRAND / "importnest-header-logo-dark.png",
    )
    light.save(BRAND / "importnest-logo-light.png", "PNG", optimize=True)
    dark.save(BRAND / "importnest-logo-dark.png", "PNG", optimize=True)

    # Footer from i+nest white IMPORT
    footer = process_footer(Image.open(FOOTER_SHEET))
    footer.save(BRAND / "importnest-footer-logo-v2.png", "PNG", optimize=True)
    shutil.copyfile(BRAND / "importnest-footer-logo-v2.png", BRAND / "importnest-footer-logo.png")

    for label, im in [
        ("header", header),
        ("headerDark", header_dark),
        ("footer", footer),
    ]:
        bb = im.getbbox()
        assert bb
        l, t, r, b = bb
        print(
            f"{label}: {im.size} aspect={im.width / im.height:.3f} "
            f"pad L{l}T{t}R{im.width - r}B{im.height - b}"
        )


if __name__ == "__main__":
    print(f"header sheet: {HEADER_SHEET.name}")
    print(f"footer sheet: {FOOTER_SHEET.name}")
    install()
