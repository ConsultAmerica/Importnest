"""Clean header/footer logos: strip edge white lines, add safe padding, bust cache names."""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"
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


def is_gold(r: int, g: int, b: int) -> bool:
    return r > 120 and g > 80 and b < 160 and r > b + 20 and r >= g - 5


def is_real_ink(r: int, g: int, b: int) -> bool:
    """Keep solid white / navy letter strokes and gold nest."""
    if is_gold(r, g, b):
        return True
    if r > 210 and g > 210 and b > 210:
        return True
    br = (r + g + b) / 3
    # Solid white-ish cart / IMPORT on dark lockups
    if br > 200 and max(r, g, b) - min(r, g, b) < 35:
        return True
    # Navy ink
    if br < 95 and b >= r and b >= g:
        return True
    return False


def strip_edge_lines(im: Image.Image) -> Image.Image:
    """Remove thin pale vertical crop marks on left/right without eating logo ink."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    assert px is not None

    band = max(10, int(w * 0.045))
    for x in list(range(0, band)) + list(range(w - band, w)):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a < 12:
                continue
            if is_real_ink(r, g, b):
                continue
            br = (r + g + b) / 3
            sat = max(r, g, b) - min(r, g, b)
            # Pale / gray / cyan fringe lines
            if br > 95 and sat < 80:
                px[x, y] = (0, 0, 0, 0)
            elif br > 140 and sat < 100 and r < 230:
                px[x, y] = (0, 0, 0, 0)

    # Extra: wipe any near-white single-column streaks in outer 2%
    for x in list(range(0, max(4, int(w * 0.02)))) + list(
        range(w - max(4, int(w * 0.02)), w)
    ):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a < 12:
                continue
            br = (r + g + b) / 3
            sat = max(r, g, b) - min(r, g, b)
            if br > 110 and sat < 55 and not is_gold(r, g, b):
                px[x, y] = (0, 0, 0, 0)

    return im


def clean(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    im = strip_edge_lines(im)
    im = trim(im, pad=6)
    im = strip_edge_lines(im)  # again after trim (lines may sit on content edge)
    im = trim(im, pad=4)
    return add_padding(im, pad=PAD)


def main() -> None:
    pairs = [
        ("importnest-header-logo-dark.png", "importnest-header-logo-v4-dark.png"),
        ("importnest-header-logo-v3.png", "importnest-header-logo-v4.png"),
        ("importnest-footer-logo.png", "importnest-footer-logo-v2.png"),
    ]
    for src_name, dst_name in pairs:
        src = BRAND / src_name
        if not src.exists():
            print(f"skip missing {src_name}")
            continue
        out = clean(src)
        dst = BRAND / dst_name
        out.save(dst, "PNG", optimize=True)
        # Keep legacy aliases pointing at cleaned files
        shutil.copyfile(dst, src)
        bb = out.getbbox()
        assert bb
        l, t, r, b = bb
        print(
            f"{dst_name}: {out.size} aspect={out.width / out.height:.3f} "
            f"pad L{l}T{t}R{out.width - r}B{out.height - b}"
        )


if __name__ == "__main__":
    main()
