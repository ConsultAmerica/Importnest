"""Install header Importnest lockup (bags/cart) without cropping the nest.

Keeps full icon height; removes only the tagline band on the wordmark side.
Adds transparent safety padding so CSS scaling does not clip edges.
Does not overwrite the footer-only i+nest lockup.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"
SHEET = Path(
    r"C:\Users\nazia\.cursor\projects\e-projects-AI-Projects-Importnest\assets"
    r"\c__Users_nazia_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"c4507f022c3b1d74886588f94ed8f17a_images_new_logo-b2797dd1-2e28-4ef0-a20a-1e36935881d2.png"
)

PAD = 24  # transparent safety margin around lockup


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


def white_to_transparent(im: Image.Image, thresh: int = 248) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    assert px is not None
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r >= thresh and g >= thresh and b >= thresh:
                px[x, y] = (r, g, b, 0)
            elif (r + g + b) / 3 >= 245 and max(r, g, b) - min(r, g, b) <= 8:
                px[x, y] = (r, g, b, 0)
    return im


def is_navy_ink(r: int, g: int, b: int) -> bool:
    brightness = (r + g + b) / 3
    if brightness > 100:
        return False
    if r > 110 and g > 70 and b < 120 and r > b + 20:
        return False
    if r > 200 and g > 200 and b > 200:
        return False
    if b >= r and b >= g and b > 30 and brightness < 95:
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


def wordmark_bottom(im: Image.Image) -> int:
    """Bottom of IMPORTNEST letters (before tagline gap)."""
    w, h = im.size
    dens: list[tuple[int, int]] = []
    for y in range(int(h * 0.15), int(h * 0.85)):
        n = 0
        for x in range(int(w * 0.30), w, 2):
            if im.getpixel((x, y))[3] > 25:
                n += 1
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


def nest_right_edge(im: Image.Image, y0: int, y1: int) -> int:
    """Furthest x of icon/nest content in a vertical band (exclude wordmark)."""
    w, h = im.size
    right = int(w * 0.22)
    for y in range(max(0, y0), min(h, y1)):
        for x in range(0, int(w * 0.45)):
            r, g, b, a = im.getpixel((x, y))
            if a < 25:
                continue
            # Nest gold / cart navy / bags — not far-right wordmark
            right = max(right, x)
    return min(w - 1, right + 8)


def remove_tagline(im: Image.Image) -> Image.Image:
    """Erase tagline text/flanks on the right; keep full nest on the left."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    assert px is not None

    wm_bottom = wordmark_bottom(im)
    # Start clearing shortly under the wordmark letters
    tag_start = min(h - 1, wm_bottom + 6)
    # Nest can extend below the letters — never clear left of nest
    cut_x = nest_right_edge(im, tag_start, h)

    for y in range(tag_start, h):
        for x in range(cut_x, w):
            px[x, y] = (0, 0, 0, 0)

    # Gold flank rules just under the wordmark
    for y in range(max(0, wm_bottom + 2), min(h, tag_start + 8)):
        gold_xs: list[int] = []
        for x in range(cut_x, w, 2):
            r, g, b, a = px[x, y]
            if a < 20:
                continue
            if r > 130 and g > 85 and b < 130 and r > b + 25:
                gold_xs.append(x)
        if not gold_xs:
            continue
        left = sum(1 for x in gold_xs if x < w * 0.45)
        right = sum(1 for x in gold_xs if x > w * 0.55)
        if left >= 3 and right >= 3:
            for x in range(cut_x, w):
                px[x, y] = (0, 0, 0, 0)

    return im


def find_icon_wordmark_gap(im: Image.Image) -> int:
    """Return x split in the quiet gap between nest icon and IMPORTNEST."""
    w, h = im.size
    y0, y1 = int(h * 0.38), int(h * 0.58)
    gaps: list[int] = []
    for x in range(int(w * 0.16), int(w * 0.48)):
        n = sum(1 for y in range(y0, y1) if im.getpixel((x, y))[3] > 25)
        if n <= 2:
            gaps.append(x)
    if not gaps:
        return int(w * 0.30)
    # Longest consecutive run
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


def extract_wordmark(im: Image.Image, icon_right: int) -> Image.Image:
    w, h = im.size
    top = h
    bottom = 0
    left = w
    right = 0
    # Only take the IMPORTNEST band (exclude tagline below)
    wm_b = wordmark_bottom(im)
    y_hi = min(h, wm_b + 4)
    for y in range(0, y_hi):
        for x in range(icon_right, w):
            if im.getpixel((x, y))[3] > 25:
                top = min(top, y)
                bottom = max(bottom, y)
                left = min(left, x)
                right = max(right, x)
    if bottom <= top:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    return im.crop((left, top, right + 1, bottom + 1))


def extract_icon_mark(im: Image.Image, split: int) -> Image.Image:
    """Full cart+bags+nest — cropped at the gap before the wordmark."""
    cleaned = remove_tagline(im.copy())
    return trim(cleaned.crop((0, 0, max(8, split - 2), cleaned.height)), pad=2)


def compose_compact(im: Image.Image, word_h: int = 72, gap: int = 14) -> Image.Image:
    """Side-by-side lockup: full nest icon + wordmark, aligned and padded."""
    split = find_icon_wordmark_gap(im)
    icon = extract_icon_mark(im, split)
    word = extract_wordmark(remove_tagline(im.copy()), split)

    if word.height < 4 or icon.height < 4:
        return add_padding(trim(remove_tagline(im)))

    scale_w = word_h / word.height
    word_r = word.resize(
        (max(1, int(word.width * scale_w)), word_h),
        Image.Resampling.LANCZOS,
    )
    icon_h = int(word_h * 1.35)
    scale_i = icon_h / icon.height
    icon_r = icon.resize(
        (max(1, int(icon.width * scale_i)), icon_h),
        Image.Resampling.LANCZOS,
    )

    canvas_h = max(icon_r.height, word_r.height)
    canvas_w = icon_r.width + gap + word_r.width
    out = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    out.paste(icon_r, (0, (canvas_h - icon_r.height) // 2), icon_r)
    out.paste(
        word_r,
        (icon_r.width + gap, (canvas_h - word_r.height) // 2),
        word_r,
    )
    return add_padding(out, pad=PAD)


def extract_icon(header: Image.Image) -> Image.Image:
    w, h = header.size
    cut_x = nest_right_edge(header, 0, h)
    return add_padding(trim(header.crop((0, 0, max(8, cut_x), h)), pad=4), pad=10)


def install() -> dict[str, float]:
    if not SHEET.exists():
        raise SystemExit(f"Missing logo: {SHEET}")

    light_full = trim(white_to_transparent(Image.open(SHEET)))
    dark_full = trim(navy_to_white(light_full.copy()))

    light = add_padding(light_full)
    dark = add_padding(dark_full)

    header = compose_compact(light_full)
    header_dark = compose_compact(dark_full)

    icon = extract_icon(header)
    icon_dark = extract_icon(header_dark)

    BRAND.mkdir(parents=True, exist_ok=True)
    light.save(BRAND / "importnest-logo-light.png", "PNG", optimize=True)
    dark.save(BRAND / "importnest-logo-dark.png", "PNG", optimize=True)
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
    print(f"light  {light.size} aspect={aspects['light']:.3f}")
    print(f"dark   {dark.size} aspect={aspects['dark']:.3f}")
    print(f"header {header.size} aspect={aspects['header']:.3f}")
    print(f"header-dark {header_dark.size} aspect={aspects['headerDark']:.3f}")
    print(f"icon   {icon.size} / {icon_dark.size}")
    return aspects


if __name__ == "__main__":
    aspects = install()
    (ROOT / "scripts" / ".logo-aspects.txt").write_text(
        "\n".join(f"{k}={v:.4f}" for k, v in aspects.items()) + "\n",
        encoding="utf-8",
    )
