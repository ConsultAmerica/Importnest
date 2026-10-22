"""Install new Importnest header (logo 1) + footer (logo 5) lockups.

Assets ship on black plates — convert to transparent, crop header tagline,
and recolor navy IMPORT → white for the dark footer lockup.
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
LOGO_LIGHT = (
    ASSETS
    / "c__Users_nazia_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"c4507f022c3b1d74886588f94ed8f17a_images_importnest_logo_1_light_transparent-071dd9db-c8c8-4aa0-97d5-ea236d402cad.png"
)
LOGO_FOOTER = (
    ASSETS
    / "c__Users_nazia_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"c4507f022c3b1d74886588f94ed8f17a_images_importnest_logo_5_transparent-bedecc3d-d3cf-4917-b20b-0f5cb4121d9e.png"
)


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


def black_to_transparent(im: Image.Image, thresh: int = 28) -> Image.Image:
    """Drop near-black plate to alpha (logo ships on solid black)."""
    im = im.convert("RGBA")
    px = im.load()
    assert px is not None
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if max(r, g, b) <= thresh:
                px[x, y] = (r, g, b, 0)
            elif r < 40 and g < 40 and b < 50 and (r + g + b) / 3 < thresh + 8:
                px[x, y] = (r, g, b, 0)
    return im


def is_navy_ink(r: int, g: int, b: int) -> bool:
    """Navy cart / IMPORT letter pixels (not gold, not white)."""
    brightness = (r + g + b) / 3
    if brightness > 95:
        return False
    # Gold / bronze
    if r > 120 and g > 80 and b < 120 and r > b + 25:
        return False
    # White / light
    if r > 200 and g > 200 and b > 200:
        return False
    # Navy-ish: blue channel dominates or dark blue-gray
    if b >= r and b >= g and b > 35 and brightness < 90:
        return True
    if r < 50 and g < 70 and 40 < b < 130:
        return True
    return False


def navy_ink_to_white(im: Image.Image) -> Image.Image:
    """For dark surfaces: turn navy IMPORT + cart ink white; keep gold."""
    im = im.convert("RGBA")
    px = im.load()
    assert px is not None
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 20:
                continue
            if is_navy_ink(r, g, b):
                # Preserve subtle shading via brightness scale
                br = max(0.55, min(1.0, (r + g + b) / 180))
                v = int(230 + 25 * br)
                px[x, y] = (v, v, v, a)
    return im


def find_tagline_cut(im: Image.Image) -> int:
    """Cut just above tagline / gold flank rules."""
    im = im.convert("RGBA")
    w, h = im.size

    def letter_density(y: int) -> int:
        n = 0
        for x in range(int(w * 0.28), w, 2):
            r, g, b, a = im.getpixel((x, y))
            if a < 20:
                continue
            if is_navy_ink(r, g, b) or (r > 200 and g > 200 and b > 200):
                n += 1
            elif r > 140 and g > 90 and b < 140 and r > b + 30:
                n += 1
        return n

    densities = [(y, letter_density(y)) for y in range(int(h * 0.18), int(h * 0.72))]
    peak = max((d for _, d in densities), default=0)
    thr = max(20, int(peak * 0.35))
    wordmark_bottom = int(h * 0.45)
    seen = False
    for y, d in densities:
        if d >= thr:
            seen = True
            wordmark_bottom = y
        elif seen and d < thr * 0.4:
            break

    for y in range(wordmark_bottom + 6, h):
        if letter_density(y) >= max(14, int(peak * 0.12)):
            return max(1, y - 3)

    # Gold flank rules
    for y in range(wordmark_bottom + 4, h):
        gold_xs: list[int] = []
        for x in range(0, w, 2):
            r, g, b, a = im.getpixel((x, y))
            if a < 20:
                continue
            if r > 140 and g > 90 and b < 140 and r > b + 30:
                gold_xs.append(x)
        if not gold_xs:
            continue
        left = sum(1 for x in gold_xs if x < w * 0.45)
        right = sum(1 for x in gold_xs if x > w * 0.55)
        span = max(gold_xs) - min(gold_xs)
        if left >= 5 and right >= 5 and span > w * 0.3:
            return max(1, y - 3)

    return min(h - 1, wordmark_bottom + max(14, int(h * 0.08)))


def extract_icon(header: Image.Image) -> Image.Image:
    w, h = header.size
    cut_x = int(w * 0.28)
    for x in range(int(w * 0.18), int(w * 0.42)):
        content = 0
        letter = 0
        for y in range(h):
            r, g, b, a = header.getpixel((x, y))
            if a < 20:
                continue
            content += 1
            if is_navy_ink(r, g, b) or (r > 200 and g > 200 and b > 200):
                letter += 1
            elif r > 140 and g > 90 and b < 140 and r > b + 30:
                letter += 1
        if content < h * 0.05 and x > int(w * 0.20):
            cut_x = x - 4
            break
        if letter > h * 0.20 and x > int(w * 0.22):
            cut_x = x - 6
            break
    return trim(header.crop((0, 0, max(8, cut_x), h)), pad=4)


def install() -> dict[str, float]:
    if not LOGO_LIGHT.exists():
        raise SystemExit(f"Missing light logo: {LOGO_LIGHT}")
    if not LOGO_FOOTER.exists():
        raise SystemExit(f"Missing footer logo: {LOGO_FOOTER}")

    light = trim(black_to_transparent(Image.open(LOGO_LIGHT)))
    footer_raw = trim(black_to_transparent(Image.open(LOGO_FOOTER)))
    # Dark/footer: white IMPORT + white cart ink for navy footer bar
    dark = trim(navy_ink_to_white(footer_raw.copy()))

    cut_l = find_tagline_cut(light)
    cut_d = find_tagline_cut(dark)
    header = trim(light.crop((0, 0, light.width, cut_l)))
    header_dark = trim(dark.crop((0, 0, dark.width, cut_d)))
    icon = extract_icon(header)
    icon_dark = extract_icon(header_dark)

    BRAND.mkdir(parents=True, exist_ok=True)
    light.save(BRAND / "importnest-logo-light.png", "PNG", optimize=True)
    dark.save(BRAND / "importnest-logo-dark.png", "PNG", optimize=True)
    # Footer uses full dark lockup (with tagline)
    dark.save(BRAND / "importnest-footer-logo.png", "PNG", optimize=True)
    header.save(BRAND / "importnest-header-logo-v3.png", "PNG", optimize=True)
    shutil.copyfile(BRAND / "importnest-header-logo-v3.png", BRAND / "importnest-header-logo-v2.png")
    header_dark.save(BRAND / "importnest-header-logo-dark.png", "PNG", optimize=True)
    icon.save(BRAND / "importnest-icon.png", "PNG", optimize=True)
    icon_dark.save(BRAND / "importnest-icon-dark.png", "PNG", optimize=True)
    light.save(BRAND / "logo9-transparent.png", "PNG", optimize=True)
    dark.save(BRAND / "logo9-on-dark.png", "PNG", optimize=True)
    icon.save(BRAND / "logo9-icon.png", "PNG", optimize=True)
    icon_dark.save(BRAND / "logo9-icon-dark.png", "PNG", optimize=True)

    aspects = {
        "header": header.width / max(1, header.height),
        "headerDark": header_dark.width / max(1, header_dark.height),
        "light": light.width / max(1, light.height),
        "dark": dark.width / max(1, dark.height),
        "icon": icon.width / max(1, icon.height),
        "iconDark": icon_dark.width / max(1, icon_dark.height),
    }
    print(f"light   {light.size}  aspect={aspects['light']:.3f}")
    print(f"dark    {dark.size}  aspect={aspects['dark']:.3f}  cut@{cut_d}")
    print(f"header  {header.size} cut@{cut_l} aspect={aspects['header']:.3f}")
    print(f"header-dark {header_dark.size} aspect={aspects['headerDark']:.3f}")
    print(f"icon    {icon.size} / dark {icon_dark.size}")
    return aspects


if __name__ == "__main__":
    aspects = install()
    (ROOT / "scripts" / ".logo-aspects.txt").write_text(
        "\n".join(f"{k}={v:.4f}" for k, v in aspects.items()) + "\n",
        encoding="utf-8",
    )
