"""Build header lockup: Concept B icon (nlogo) + importnest wordmark from sheet."""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"
ASSETS = Path(
    r"C:\Users\nazia\.cursor\projects\e-projects-AI-Projects-Importnest\assets"
)
SHEET = next(ASSETS.glob("*final2-3cb4d23e*.png"))
ICON_SHEET = next(ASSETS.glob("*nlogo-1f73bf48*.png"))
PAD = 28


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


def white_to_transparent(im: Image.Image, thresh: int = 245) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    assert px is not None
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if r >= thresh and g >= thresh and b >= thresh:
                px[x, y] = (r, g, b, 0)
            elif (r + g + b) / 3 >= 238 and max(r, g, b) - min(r, g, b) <= 12:
                px[x, y] = (r, g, b, 0)
    return im


def is_navy_ink(r: int, g: int, b: int) -> bool:
    br = (r + g + b) / 3
    if br > 110:
        return False
    if r > 120 and g > 80 and b < 140 and r > b + 25:
        return False
    if r > 200 and g > 200 and b > 200:
        return False
    if b >= r and b >= g and b > 25 and br < 105:
        return True
    if r < 60 and g < 80 and 30 < b < 140:
        return True
    return False


def navy_to_white(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    assert px is not None
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            if is_navy_ink(r, g, b):
                br = max(0.55, min(1.0, (r + g + b) / 150))
                v = int(235 + 20 * br)
                px[x, y] = (v, v, v, a)
    return im


def extract_concept_b(sheet: Image.Image) -> Image.Image:
    w, h = sheet.size
    left = sheet.crop((0, 0, int(w * 0.48), h))
    return trim(white_to_transparent(left))


def extract_wordmark(concept: Image.Image) -> Image.Image:
    """Wordmark band sits under the large icon (around 48–56% height)."""
    w, h = concept.size
    # From density scan: icon ends ~288, wordmark ~304–340, tagline from ~368
    y0 = int(h * 0.46)
    y1 = int(h * 0.56)
    band = concept.crop((0, y0, w, y1))
    return trim(band, pad=2)


def compose(icon: Image.Image, word: Image.Image, word_h: int = 56, gap: int = 14) -> Image.Image:
    scale_w = word_h / max(1, word.height)
    word_r = word.resize(
        (max(1, int(word.width * scale_w)), word_h), Image.Resampling.LANCZOS
    )
    icon_h = int(word_h * 1.35)
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


def install() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)

    icon = trim(white_to_transparent(Image.open(ICON_SHEET)), pad=6)
    concept = extract_concept_b(Image.open(SHEET))
    word = extract_wordmark(concept)

    # Upscale wordmark from sheet for sharper header
    word = word.resize((word.width * 3, word.height * 3), Image.Resampling.LANCZOS)

    header_light = compose(icon, word)
    header_dark = compose(navy_to_white(icon.copy()), navy_to_white(word.copy()))

    icon_pad = add_padding(icon, pad=20)
    icon_dark = navy_to_white(icon_pad.copy())

    header_light.save(BRAND / "importnest-header-logo-v5.png", "PNG", optimize=True)
    header_dark.save(BRAND / "importnest-header-logo-v5-dark.png", "PNG", optimize=True)
    for alias in [
        "importnest-header-logo-v4.png",
        "importnest-header-logo-v3.png",
        "importnest-header-logo-v2.png",
    ]:
        shutil.copyfile(BRAND / "importnest-header-logo-v5.png", BRAND / alias)
    shutil.copyfile(
        BRAND / "importnest-header-logo-v5-dark.png",
        BRAND / "importnest-header-logo-v4-dark.png",
    )
    shutil.copyfile(
        BRAND / "importnest-header-logo-v5-dark.png",
        BRAND / "importnest-header-logo-dark.png",
    )

    # Full concept B (stacked) for marketing
    add_padding(concept).save(BRAND / "importnest-logo-light.png", "PNG", optimize=True)
    add_padding(navy_to_white(concept.copy())).save(
        BRAND / "importnest-logo-dark.png", "PNG", optimize=True
    )

    icon_pad.save(BRAND / "importnest-icon.png", "PNG", optimize=True)
    icon_dark.save(BRAND / "importnest-icon-dark.png", "PNG", optimize=True)
    icon_pad.save(BRAND / "logo9-icon.png", "PNG", optimize=True)
    icon_dark.save(BRAND / "logo9-icon-dark.png", "PNG", optimize=True)

    preview = Path(BRAND / "_conceptb-preview.jpg")
    if preview.exists():
        preview.unlink()

    print(f"icon {icon.size} word {word.size}")
    print(
        f"header light {header_light.size} "
        f"aspect={header_light.width / header_light.height:.3f}"
    )
    print(
        f"header dark  {header_dark.size} "
        f"aspect={header_dark.width / header_dark.height:.3f}"
    )


if __name__ == "__main__":
    install()
