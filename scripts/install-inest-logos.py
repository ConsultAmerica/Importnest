"""Install i+nest lockups for navy header/footer and light surfaces.

Sources:
  - white IMPORT → headerDark + footer (navy UI)
  - dark IMPORT  → header (light surfaces)

Removes plate, edge crop marks, POR counter navy; adds safety padding.
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
SHEET_ON_DARK = next(ASSETS.glob("*image-caa1d87f*.png"))  # white IMPORT
SHEET_ON_LIGHT = next(ASSETS.glob("*image-f5de45c9*.png"))  # navy IMPORT

PLATE = (5, 63, 113)
PAD = 20


def is_plate(r: int, g: int, b: int, tol: int = 32) -> bool:
    return (
        abs(r - PLATE[0]) <= tol
        and abs(g - PLATE[1]) <= tol
        and abs(b - PLATE[2]) <= tol
    )


def is_gold(r: int, g: int, b: int) -> bool:
    return r > 110 and g > 70 and b < 155 and r > b + 15 and r >= g - 10


def is_white_ink(r: int, g: int, b: int) -> bool:
    return r > 185 and g > 185 and b > 185


def is_navy_ink(r: int, g: int, b: int) -> bool:
    """Dark IMPORT letter ink (keep on light lockup)."""
    if is_gold(r, g, b) or is_white_ink(r, g, b):
        return False
    br = (r + g + b) / 3
    if br > 100:
        return False
    if b >= r and b >= g and br < 95:
        return True
    if r < 60 and g < 80 and 30 < b < 130:
        return True
    return False


def is_counter_or_plate(r: int, g: int, b: int) -> bool:
    """Plate + soft navy fills inside P/O/R (not solid letter strokes)."""
    if is_gold(r, g, b) or is_white_ink(r, g, b):
        return False
    if is_plate(r, g, b, tol=40):
        return True
    br = (r + g + b) / 3
    sat = max(r, g, b) - min(r, g, b)
    # Soft plate blends / counter fills (lighter than solid IMPORT ink)
    if 40 < br < 150 and b > r + 8 and b >= g and r < 120 and sat > 12:
        return True
    return False


def is_edge_artifact(r: int, g: int, b: int) -> bool:
    if is_gold(r, g, b) or is_white_ink(r, g, b) or is_navy_ink(r, g, b):
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


def process(im: Image.Image, *, keep_navy_letters: bool) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    assert px is not None

    wordmark_x = int(w * 0.30)
    left_scan = max(10, int(w * 0.04))
    right_scan = w - max(10, int(w * 0.045))

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue

            # Edge crop marks
            if x <= left_scan or x >= right_scan:
                if is_edge_artifact(r, g, b) or is_plate(r, g, b, tol=45):
                    px[x, y] = (0, 0, 0, 0)
                    continue
            if x <= int(w * 0.02) or x >= int(w * 0.98):
                br = (r + g + b) / 3
                if br > 95 and not is_gold(r, g, b) and not is_white_ink(r, g, b):
                    if not (keep_navy_letters and is_navy_ink(r, g, b)):
                        px[x, y] = (0, 0, 0, 0)
                        continue

            if is_gold(r, g, b) or is_white_ink(r, g, b):
                continue

            # Keep dark tag disc in icon
            br = (r + g + b) / 3
            if x < wordmark_x and br < 55 and b > 25:
                continue

            if keep_navy_letters and is_navy_ink(r, g, b) and not is_plate(r, g, b, tol=28):
                # Solid IMPORT strokes — keep; only clear plate-like counters
                if x >= wordmark_x and is_plate(r, g, b, tol=36):
                    px[x, y] = (0, 0, 0, 0)
                continue

            if is_counter_or_plate(r, g, b) or is_plate(r, g, b, tol=36):
                px[x, y] = (0, 0, 0, 0)
                continue

            # On-dark sheet: any leftover mid navy in wordmark → transparent
            if not keep_navy_letters and x >= wordmark_x:
                if br < 170 and b >= g and b > r and not is_white_ink(r, g, b):
                    px[x, y] = (0, 0, 0, 0)

    return add_padding(trim(im, pad=8), pad=PAD)


def extract_icon(lockup: Image.Image) -> Image.Image:
    w, h = lockup.size
    # Gap between icon and wordmark
    y0, y1 = int(h * 0.35), int(h * 0.65)
    gaps: list[int] = []
    for x in range(int(w * 0.18), int(w * 0.55)):
        n = sum(1 for y in range(y0, y1) if lockup.getpixel((x, y))[3] > 30)
        if n <= 2:
            gaps.append(x)
    split = int(w * 0.32)
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
    return add_padding(trim(lockup.crop((0, 0, split, h)), pad=4), pad=12)


def install() -> dict[str, float]:
    on_dark = process(Image.open(SHEET_ON_DARK), keep_navy_letters=False)
    on_light = process(Image.open(SHEET_ON_LIGHT), keep_navy_letters=True)

    icon_dark = extract_icon(on_dark)
    icon_light = extract_icon(on_light)

    BRAND.mkdir(parents=True, exist_ok=True)

    # Navy header + footer share the white-IMPORT lockup
    on_dark.save(BRAND / "importnest-header-logo-dark.png", "PNG", optimize=True)
    on_dark.save(BRAND / "importnest-footer-logo.png", "PNG", optimize=True)
    shutil.copyfile(
        BRAND / "importnest-header-logo-dark.png",
        BRAND / "importnest-logo-dark.png",
    )

    # Light-surface lockup (navy IMPORT)
    on_light.save(BRAND / "importnest-header-logo-v3.png", "PNG", optimize=True)
    shutil.copyfile(
        BRAND / "importnest-header-logo-v3.png",
        BRAND / "importnest-header-logo-v2.png",
    )
    shutil.copyfile(
        BRAND / "importnest-header-logo-v3.png",
        BRAND / "importnest-logo-light.png",
    )

    icon_light.save(BRAND / "importnest-icon.png", "PNG", optimize=True)
    icon_dark.save(BRAND / "importnest-icon-dark.png", "PNG", optimize=True)
    on_light.save(BRAND / "logo9-transparent.png", "PNG", optimize=True)
    on_dark.save(BRAND / "logo9-on-dark.png", "PNG", optimize=True)
    icon_light.save(BRAND / "logo9-icon.png", "PNG", optimize=True)
    icon_dark.save(BRAND / "logo9-icon-dark.png", "PNG", optimize=True)

    aspects = {
        "header": on_light.width / max(1, on_light.height),
        "headerDark": on_dark.width / max(1, on_dark.height),
        "footer": on_dark.width / max(1, on_dark.height),
        "icon": icon_light.width / max(1, icon_light.height),
        "iconDark": icon_dark.width / max(1, icon_dark.height),
    }
    print(f"on-light (header) {on_light.size} aspect={aspects['header']:.3f}")
    print(f"on-dark  (headerDark/footer) {on_dark.size} aspect={aspects['headerDark']:.3f}")
    print(f"icon {icon_light.size} / {icon_dark.size}")
    print(f"sources:\n  dark-bg <- {SHEET_ON_DARK.name}\n  light-bg <- {SHEET_ON_LIGHT.name}")
    return aspects


if __name__ == "__main__":
    aspects = install()
    (ROOT / "scripts" / ".logo-aspects.txt").write_text(
        "\n".join(f"{k}={v:.4f}" for k, v in aspects.items()) + "\n",
        encoding="utf-8",
    )
