"""Uniform skin circle fills (no white/gray plates) + header without tagline."""

from __future__ import annotations

import importlib.util
import shutil
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "images" / "subtypes"
BRAND = ROOT / "public" / "brand"
ASSETS = Path(
    r"C:\Users\nazia\.cursor\projects\e-projects-AI-Projects-Importnest\assets"
)
LOGO_SHEET = (
    ASSETS
    / "c__Users_nazia_AppData_Roaming_Cursor_User_workspaceStorage_c4507f022c3b1d74886588f94ed8f17a_images_n_logo-be22c45b-4f26-40d1-94ad-60afab6ed5cb.png"
)
SKIN = (237, 232, 226)  # #EDE8E2
SIZE = 512

spec = importlib.util.spec_from_file_location(
    "fix_circles_and_logo", ROOT / "scripts" / "fix-circles-and-logo.py"
)
assert spec and spec.loader
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
SOURCES = mod.SOURCES


def is_neutral_plate(r: int, g: int, b: int) -> bool:
    """White, near-white, gray, and warm cream studio backgrounds."""
    brightness = (r + g + b) / 3
    chroma = max(r, g, b) - min(r, g, b)
    if r >= 230 and g >= 230 and b >= 230:
        return True
    if brightness >= 248 and chroma <= 16:
        return True
    # Light / cool studio gray plates
    if brightness >= 188 and chroma <= 22:
        return True
    # Warm cream / lit studio backdrop (edge-flood only; protects interior product)
    if brightness >= 210 and chroma <= 85 and r >= g - 6 and r > b + 5:
        return True
    return False


def flood_fill_plate(im: Image.Image) -> Image.Image:
    """Replace edge-connected neutral plate with skin fill."""
    im = im.convert("RGB")
    w, h = im.size
    px = im.load()
    assert px is not None
    seen = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def try_push(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            return
        if not is_neutral_plate(*px[x, y]):
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
        px[x, y] = SKIN
        try_push(x + 1, y)
        try_push(x - 1, y)
        try_push(x, y + 1)
        try_push(x, y - 1)

    # Grow into plate pixels next to skin (crosses soft gradient barriers)
    for _ in range(20):
        fixes: list[tuple[int, int]] = []
        for y in range(h):
            for x in range(w):
                if px[x, y] == SKIN:
                    continue
                if not is_neutral_plate(*px[x, y]):
                    continue
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny] == SKIN:
                        fixes.append((x, y))
                        break
        if not fixes:
            break
        for x, y in fixes:
            px[x, y] = SKIN
    return im


def cover(im: Image.Image, size: int, zoom: float = 1.18) -> Image.Image:
    im = im.convert("RGB")
    w, h = im.size
    side = min(w, h)
    zs = max(1, int(side / zoom))
    left = (w - zs) // 2
    top = (h - zs) // 2
    return im.crop((left, top, left + zs, top + zs)).resize((size, size), Image.Resampling.LANCZOS)


def make_tile(src: Path) -> Image.Image:
    base = Image.new("RGB", (SIZE, SIZE), SKIN)
    product = flood_fill_plate(cover(Image.open(src), SIZE))
    base.paste(product, (0, 0))
    return flood_fill_plate(base)


def rebuild_tiles() -> None:
    made = 0
    for cat, items in SOURCES.items():
        dest = OUT / cat
        dest.mkdir(parents=True, exist_ok=True)
        for slug, rel in items:
            p = ROOT / rel
            if not p.exists():
                print("MISSING", rel)
                continue
            make_tile(p).save(dest / f"{slug}.png", "PNG", optimize=True)
            made += 1
    print(f"Rebuilt {made} uniform skin-fill tiles")


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
    return im


def navy_plate_to_transparent(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    assert px is not None
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r >= 248 and g >= 248 and b >= 248:
                px[x, y] = (r, g, b, 0)
                continue
            brightness = (r + g + b) / 3
            if brightness < 70 and b > r + 40 and r < 40 and 40 < g < 90 and 80 < b < 140:
                px[x, y] = (r, g, b, 0)
    return im


def trim(im: Image.Image, pad: int = 6) -> Image.Image:
    bb = im.getbbox()
    if not bb:
        return im
    l, t, r, b = bb
    return im.crop(
        (max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad))
    )


def find_tagline_cut(im: Image.Image) -> int:
    """Cut just above gold tagline rules; keep full cart + wordmark."""
    im = im.convert("RGBA")
    w, h = im.size
    # Tagline rules sit below the wordmark: gold dashes, almost no navy letterforms.
    for y in range(int(h * 0.55), h):
        gold = navy = content = 0
        for x in range(0, w, 2):
            r, g, b, a = im.getpixel((x, y))
            if a < 20:
                continue
            if r > 240 and g > 240 and b > 240:
                continue
            content += 1
            if b > r + 30 and b > 70:
                navy += 1
            if r > 150 and g > 110 and b < 130 and r > b + 35:
                gold += 1
        if gold >= 8 and navy <= 3 and content < 80:
            return max(1, y - 8)
    return int(h * 0.62)


def crop_header(full: Image.Image) -> Image.Image:
    cut = find_tagline_cut(full)
    return trim(full.crop((0, 0, full.width, cut)))


def install_logo() -> dict[str, float]:
    if not LOGO_SHEET.exists():
        raise SystemExit(f"Missing logo sheet: {LOGO_SHEET}")
    sheet = Image.open(LOGO_SHEET).convert("RGBA")
    w, h = sheet.size
    split = h // 2
    for y in range(h // 3, (2 * h) // 3):
        r, g, b, _a = sheet.getpixel((w // 2, y))
        if r < 40 and b > 80:
            split = y
            break

    light = trim(white_to_transparent(sheet.crop((0, 0, w, split))))
    dark = trim(navy_plate_to_transparent(sheet.crop((0, split, w, h))))
    header = crop_header(light)
    header_dark = crop_header(dark)

    BRAND.mkdir(parents=True, exist_ok=True)
    light.save(BRAND / "importnest-logo-light.png", "PNG", optimize=True)
    dark.save(BRAND / "importnest-logo-dark.png", "PNG", optimize=True)
    header.save(BRAND / "importnest-header-logo-v3.png", "PNG", optimize=True)
    shutil.copyfile(BRAND / "importnest-header-logo-v3.png", BRAND / "importnest-header-logo-v2.png")
    header_dark.save(BRAND / "importnest-header-logo-dark.png", "PNG", optimize=True)
    light.save(BRAND / "logo9-transparent.png", "PNG", optimize=True)
    dark.save(BRAND / "logo9-on-dark.png", "PNG", optimize=True)

    aspects = {
        "header": header.width / max(1, header.height),
        "light": light.width / max(1, light.height),
        "dark": dark.width / max(1, dark.height),
    }
    print(f"Logo split@{split}: header {header.size} aspect={aspects['header']:.3f}")
    print(f"  light {light.size}  dark {dark.size}")
    return aspects


if __name__ == "__main__":
    aspects = install_logo()
    (ROOT / "scripts" / ".logo-aspects.txt").write_text(
        f"headerAspect={aspects['header']:.4f}\n"
        f"horizontalAspect={aspects['light']:.4f}\n"
        f"darkAspect={aspects['dark']:.4f}\n",
        encoding="utf-8",
    )
    rebuild_tiles()
