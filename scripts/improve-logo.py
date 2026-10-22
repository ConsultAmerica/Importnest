"""Install Importnest logos from the latest navy/gold sheet (logo3).

Light: navy cart + navy IMPORT + gold NEST
Dark:  white cart + white IMPORT + gold NEST (navy plate removed)

Produces:
- importnest-logo-light.png / importnest-logo-dark.png  (full + tagline)
- importnest-header-logo-v3.png / importnest-header-logo-dark.png  (no tagline)
- importnest-icon.png / importnest-icon-dark.png  (mark only)
- logo9-* aliases
"""

from __future__ import annotations

import shutil
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"
SHEET = Path(
    r"C:\Users\nazia\.cursor\projects\e-projects-AI-Projects-Importnest\assets"
    r"\c__Users_nazia_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"c4507f022c3b1d74886588f94ed8f17a_images_n_logo3-0e72c1d6-e5a4-4443-b277-48707d2ec7ed.png"
)


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
    return im


def plate_to_transparent(im: Image.Image) -> Image.Image:
    """Remove outer white + navy rounded plate.

    Critical: dark lockup has a WHITE cart + white IMPORT — never clear those.
    Two-phase flood: (1) outer white from edges, (2) navy plate only.
    """
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    assert px is not None

    def texture(x: int, y: int) -> float:
        vals: list[float] = []
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    r, g, b, _a = px[nx, ny]
                    vals.append((r + g + b) / 3)
        if len(vals) < 2:
            return 0.0
        mean = sum(vals) / len(vals)
        return sum((v - mean) ** 2 for v in vals) / len(vals)

    def is_outer_white(r: int, g: int, b: int, a: int) -> bool:
        return a >= 8 and r >= 246 and g >= 246 and b >= 246

    def is_navy_plate(r: int, g: int, b: int, a: int, x: int, y: int) -> bool:
        if a < 8:
            return False
        brightness = (r + g + b) / 3
        chroma = max(r, g, b) - min(r, g, b)
        if brightness < 28:
            return True
        # Flat navy plate — not gold, not white cart/text
        if r < 60 and 30 < g < 110 and 70 < b < 160 and chroma < 130 and brightness < 115:
            return texture(x, y) < 28
        return False

    def flood(predicate) -> None:
        seen = [[False] * w for _ in range(h)]
        q: deque[tuple[int, int]] = deque()

        def try_push(x: int, y: int) -> None:
            if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
                return
            if not predicate(x, y):
                return
            seen[y][x] = True
            q.append((x, y))

        for x in range(w):
            try_push(x, 0)
            try_push(x, h - 1)
        for y in range(h):
            try_push(0, y)
            try_push(w - 1, y)

        while q:
            x, y = q.popleft()
            r, g, b, _a = px[x, y]
            px[x, y] = (r, g, b, 0)
            try_push(x + 1, y)
            try_push(x - 1, y)
            try_push(x, y + 1)
            try_push(x, y - 1)

    # Phase 1: outer white only (stops at navy plate)
    flood(lambda x, y: is_outer_white(*px[x, y]))

    # Phase 2: navy plate from edges (now reachable); never touches white cart
    flood(lambda x, y: is_navy_plate(*px[x, y], x, y))

    # Soft navy anti-alias next to cleared pixels only (not white)
    for _ in range(5):
        fixes: list[tuple[int, int]] = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a < 8:
                    continue
                brightness = (r + g + b) / 3
                chroma = max(r, g, b) - min(r, g, b)
                if brightness >= 140:
                    continue  # protect white cart / IMPORT
                if not (brightness < 120 and chroma < 70 and b >= r and texture(x, y) < 30):
                    continue
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] < 8:
                        fixes.append((x, y))
                        break
        if not fixes:
            break
        for x, y in fixes:
            r, g, b, _a = px[x, y]
            px[x, y] = (r, g, b, 0)

    return im


def find_navy_split(sheet: Image.Image) -> int:
    rgb = sheet.convert("RGB")
    w, h = rgb.size
    for y in range(h // 4, (3 * h) // 4):
        samples = [rgb.getpixel((x, y)) for x in range(0, w, 8)]
        navy = sum(1 for r, g, b in samples if r < 40 and 30 < g < 90 and 70 < b < 140)
        if navy > len(samples) * 0.55:
            return y
    return h // 2


def find_tagline_cut(im: Image.Image) -> int:
    """Cut above tagline text / gold rules; keep full cart under the wordmark."""
    im = im.convert("RGBA")
    w, h = im.size

    def letter_density(y: int) -> int:
        letter = 0
        for x in range(int(w * 0.30), w, 2):
            r, g, b, a = im.getpixel((x, y))
            if a < 20:
                continue
            if b > r + 25 and b > 60:
                letter += 1
            elif r > 200 and g > 200 and b > 200:
                letter += 1
            elif r > 140 and g > 100 and b < 140 and r > b + 30:
                letter += 1
        return letter

    densities = [(y, letter_density(y)) for y in range(int(h * 0.20), int(h * 0.70))]
    peak = max((d for _, d in densities), default=0)
    threshold = max(25, int(peak * 0.35))
    wordmark_bottom = int(h * 0.45)
    seen_peak = False
    for y, d in densities:
        if d >= threshold:
            seen_peak = True
            wordmark_bottom = y
        elif seen_peak and d < threshold * 0.45:
            break

    # Tagline text returns in the right half after a quiet gap under the wordmark
    for y in range(wordmark_bottom + 10, h):
        if letter_density(y) >= max(18, int(peak * 0.12)):
            return max(1, y - 2)

    for y in range(wordmark_bottom + 4, h):
        gold_xs: list[int] = []
        for x in range(0, w, 2):
            r, g, b, a = im.getpixel((x, y))
            if a < 20:
                continue
            if r > 140 and g > 100 and b < 140 and r > b + 30:
                gold_xs.append(x)
        if not gold_xs:
            continue
        left = sum(1 for x in gold_xs if x < w * 0.45)
        right = sum(1 for x in gold_xs if x > w * 0.55)
        span = max(gold_xs) - min(gold_xs)
        if left >= 6 and right >= 6 and span > w * 0.35:
            return max(1, y - 4)

    return min(h - 1, wordmark_bottom + max(14, int(h * 0.08)))


def extract_icon(full: Image.Image) -> Image.Image:
    """Left cart/nest mark only — crop before the wordmark."""
    full = full.convert("RGBA")
    w, h = full.size
    cut_x = int(w * 0.26)
    for x in range(int(w * 0.18), int(w * 0.42)):
        content = 0
        bright = 0
        navy = 0
        gold = 0
        for y in range(h):
            r, g, b, a = full.getpixel((x, y))
            if a < 20:
                continue
            content += 1
            if r > 200 and g > 200 and b > 200:
                bright += 1
            if b > r + 25 and b > 60:
                navy += 1
            if r > 140 and g > 100 and b < 140 and r > b + 30:
                gold += 1
        letterish = navy + bright + gold
        if content < h * 0.05 and x > int(w * 0.20):
            cut_x = x - 4
            break
        if letterish > h * 0.20 and x > int(w * 0.22):
            cut_x = x - 6
            break
    return trim(full.crop((0, 0, max(8, cut_x), h)), pad=6)


def install() -> dict[str, float]:
    if not SHEET.exists():
        raise SystemExit(f"Missing logo sheet: {SHEET}")

    sheet = Image.open(SHEET).convert("RGBA")
    split = find_navy_split(sheet)
    print(f"Sheet {sheet.size}, split@{split}")

    light = trim(white_to_transparent(sheet.crop((0, 0, sheet.width, split))))
    dark = trim(plate_to_transparent(sheet.crop((0, split, sheet.width, sheet.height))))

    cut_l = find_tagline_cut(light)
    cut_d = find_tagline_cut(dark)
    header = trim(light.crop((0, 0, light.width, cut_l)))
    header_dark = trim(dark.crop((0, 0, dark.width, cut_d)))
    icon = extract_icon(header)
    icon_dark = extract_icon(header_dark)

    BRAND.mkdir(parents=True, exist_ok=True)
    paths = {
        "light": BRAND / "importnest-logo-light.png",
        "dark": BRAND / "importnest-logo-dark.png",
        "header": BRAND / "importnest-header-logo-v3.png",
        "header_v2": BRAND / "importnest-header-logo-v2.png",
        "header_dark": BRAND / "importnest-header-logo-dark.png",
        "icon": BRAND / "importnest-icon.png",
        "icon_dark": BRAND / "importnest-icon-dark.png",
        "logo9": BRAND / "logo9-transparent.png",
        "logo9_dark": BRAND / "logo9-on-dark.png",
        "logo9_icon": BRAND / "logo9-icon.png",
        "logo9_icon_dark": BRAND / "logo9-icon-dark.png",
    }

    light.save(paths["light"], "PNG", optimize=True)
    dark.save(paths["dark"], "PNG", optimize=True)
    header.save(paths["header"], "PNG", optimize=True)
    shutil.copyfile(paths["header"], paths["header_v2"])
    header_dark.save(paths["header_dark"], "PNG", optimize=True)
    icon.save(paths["icon"], "PNG", optimize=True)
    icon_dark.save(paths["icon_dark"], "PNG", optimize=True)
    light.save(paths["logo9"], "PNG", optimize=True)
    dark.save(paths["logo9_dark"], "PNG", optimize=True)
    icon.save(paths["logo9_icon"], "PNG", optimize=True)
    icon_dark.save(paths["logo9_icon_dark"], "PNG", optimize=True)

    aspects = {
        "header": header.width / max(1, header.height),
        "headerDark": header_dark.width / max(1, header_dark.height),
        "light": light.width / max(1, light.height),
        "dark": dark.width / max(1, dark.height),
        "icon": icon.width / max(1, icon.height),
        "iconDark": icon_dark.width / max(1, icon_dark.height),
    }
    print(f"light  {light.size}  aspect={aspects['light']:.3f}")
    print(f"dark   {dark.size}  aspect={aspects['dark']:.3f}")
    print(f"header {header.size} cut@{cut_l} aspect={aspects['header']:.3f}")
    print(f"header-dark {header_dark.size} cut@{cut_d} aspect={aspects['headerDark']:.3f}")
    print(f"icon   {icon.size}  aspect={aspects['icon']:.3f}")
    print(f"icon-dark {icon_dark.size}  aspect={aspects['iconDark']:.3f}")
    return aspects


if __name__ == "__main__":
    aspects = install()
    (ROOT / "scripts" / ".logo-aspects.txt").write_text(
        "\n".join(f"{k}={v:.4f}" for k, v in aspects.items()) + "\n",
        encoding="utf-8",
    )
