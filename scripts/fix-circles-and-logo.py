"""Rebuild circle tiles + install improved Importnest logo.

Circle tiles:
- Remove near-white studio plates
- Keep a warm light-gray / skin fill across the FULL square
- Opaque PNGs (CSS border-radius clips to circle) — no white bands

Logo:
- Split light/dark lockups from the provided sheet
- Header = icon + IMPORTNEST only (no tagline)
"""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path(
    r"C:\Users\nazia\.cursor\projects\e-projects-AI-Projects-Importnest\assets"
)
BRAND = ROOT / "public" / "brand"
OUT = ROOT / "public" / "images" / "subtypes"
SIZE = 512

# Warm light gray / skin — fills every circle, never pure white
SKIN = (237, 232, 226)  # #EDE8E2

LOGO_SHEET = (
    ASSETS
    / "c__Users_nazia_AppData_Roaming_Cursor_User_workspaceStorage_c4507f022c3b1d74886588f94ed8f17a_images_n_logo-be22c45b-4f26-40d1-94ad-60afab6ed5cb.png"
)

SOURCES: dict[str, list[tuple[str, str]]] = {
    "appliances": [
        ("refrigerator", "public/images/products/appliances/refrigerator.jpg"),
        ("washing-machine", "public/images/products/appliances/washing-machine.jpg"),
        ("air-fryer", "public/images/products/appliances/air-fryer.jpg"),
        ("dishwasher", "public/images/products/appliances/dishwasher.jpg"),
        ("freezer", "public/images/products/appliances/freezer.jpg"),
        ("slow-cooker", "public/images/products/appliances/slow-cooker.jpg"),
        ("vacuum", "public/images/products/appliances/vacuum.jpg"),
        ("air-purifier", "public/images/products/appliances/air-purifier.jpg"),
        ("coffee-maker", "public/images/products/appliances/coffee-maker.jpg"),
        ("microwave", "public/images/products/appliances/microwave.jpg"),
    ],
    "electronics": [
        ("phone", "public/images/products/electronics/phone.jpg"),
        ("laptop", "public/images/products/electronics/laptop.jpg"),
        ("tablet", "public/images/products/electronics/tablet.jpg"),
        ("headphones", "public/images/products/electronics/headphones.jpg"),
        ("earbuds", "public/images/products/electronics/earbuds.jpg"),
        ("monitor", "public/images/products/electronics/monitor.jpg"),
        ("smartwatch", "public/images/products/electronics/smartwatch.jpg"),
        ("speaker", "public/images/products/electronics/speaker.jpg"),
        ("camera", "public/images/products/electronics/camera.jpg"),
        ("gaming", "public/images/products/electronics/gaming.jpg"),
    ],
    "kitchen": [
        ("cookware", "public/images/products/kitchen/cookware.jpg"),
        ("blender", "public/images/products/kitchen/blender.jpg"),
        ("coffee-machine", "public/images/products/kitchen/coffee-machine.jpg"),
        ("knife-set", "public/images/products/kitchen/knife-set.jpg"),
        ("stand-mixer", "public/images/products/kitchen/stand-mixer.jpg"),
        ("cutting-board", "public/images/products/kitchen/cutting-board.jpg"),
        ("kettle", "public/images/products/kitchen/kettle.jpg"),
        ("bakeware", "public/images/products/kitchen/bakeware.jpg"),
        ("food-storage", "public/images/products/kitchen/food-storage.jpg"),
        ("organizer", "public/images/products/kitchen/organizer.jpg"),
    ],
    "footwear": [
        ("running-shoe", "public/images/products/footwear/running-shoe.jpg"),
        ("sneaker", "public/images/products/footwear/canvas-sneaker.jpg"),
        ("trail-runner", "public/images/products/footwear/trail-runner.jpg"),
        ("hiking-boot", "public/images/products/footwear/hiking-boot.jpg"),
        ("sandal", "public/images/products/footwear/sandal.jpg"),
        ("loafer", "public/images/products/footwear/loafer.jpg"),
        ("winter-boot", "public/images/products/footwear/winter-boot.jpg"),
        ("training-shoe", "public/images/products/footwear/training-shoe.jpg"),
        ("casual-shoe", "public/images/products/footwear/casual-shoe.jpg"),
        ("dress-shoe", "public/images/products/footwear/dress-shoe.jpg"),
    ],
    "beauty": [
        ("hair-dryer", "public/images/products/beauty/hair-dryer.jpg"),
        ("facial-cleansing-brush", "public/images/products/beauty/facial-cleansing-brush.jpg"),
        ("electric-shaver", "public/images/products/beauty/electric-shaver.jpg"),
        ("skincare-fridge", "public/images/products/beauty/skincare-fridge.jpg"),
        ("curling-iron", "public/images/products/beauty/curling-iron.jpg"),
        ("hair-straightener", "public/images/products/beauty/hair-straightener.jpg"),
        ("led-mirror", "public/images/products/beauty/led-mirror.jpg"),
        ("massage-tool", "public/images/products/beauty/massage-tool.jpg"),
        ("manicure-kit", "public/images/products/beauty/manicure-kit.jpg"),
        ("grooming-kit", "public/images/products/beauty/grooming-kit.jpg"),
    ],
    "accessories": [
        ("wallet", "public/images/products/accessories/wallet.jpg"),
        ("backpack", "public/images/products/accessories/backpack.jpg"),
        ("phone-case", "public/images/products/accessories/phone-case.jpg"),
        ("sunglasses", "public/images/products/accessories/sunglasses.jpg"),
        ("crossbody-bag", "public/images/products/accessories/crossbody-bag.jpg"),
        ("watch-band", "public/images/products/accessories/watch-band.jpg"),
        ("charging-cable", "public/images/products/accessories/charging-cable.jpg"),
        ("laptop-sleeve", "public/images/products/accessories/laptop-sleeve.jpg"),
        ("wireless-charger", "public/images/products/accessories/wireless-charger.jpg"),
        ("travel-organizer", "public/images/products/accessories/travel-organizer.jpg"),
    ],
    "automotive": [
        ("dash-cam", "public/images/products/automotive/dash-cam.jpg"),
        ("phone-mount", "public/images/products/automotive/phone-mount.jpg"),
        ("floor-mats", "public/images/products/automotive/floor-mats.jpg"),
        ("tire-inflator", "public/images/products/automotive/tire-inflator.jpg"),
        ("car-vacuum", "public/images/products/automotive/car-vacuum.jpg"),
        ("battery-charger", "public/images/products/automotive/battery-charger.jpg"),
        ("seat-cover", "public/images/products/automotive/seat-cover.jpg"),
        ("wipers", "public/images/products/automotive/wipers.jpg"),
        ("tool-kit", "public/images/products/automotive/tool-kit.jpg"),
        ("jump-starter", "public/images/products/automotive/jump-starter.jpg"),
    ],
    "outdoors": [
        ("hiking-backpack", "public/images/products/outdoors/hiking-backpack.jpg"),
        ("tent", "public/images/products/outdoors/tent.jpg"),
        ("sleeping-bag", "public/images/products/outdoors/sleeping-bag.jpg"),
        ("camp-stove", "public/images/products/outdoors/camp-stove.jpg"),
        ("water-bottle", "public/images/products/outdoors/water-bottle.jpg"),
        ("lantern", "public/images/products/outdoors/lantern.jpg"),
        ("outdoor-chair", "public/images/products/outdoors/outdoor-chair.jpg"),
        ("cooler", "public/images/products/outdoors/cooler.jpg"),
        ("picnic-blanket", "public/images/products/outdoors/picnic-blanket.jpg"),
        ("travel-bag", "public/images/products/outdoors/travel-bag.jpg"),
    ],
    "home": [
        ("blanket", "public/images/products/home/blanket.jpg"),
        ("table-lamp", "public/images/products/home/table-lamp.jpg"),
        ("storage-bins", "public/images/products/home/storage-bins.jpg"),
        ("throw-pillow", "public/images/products/home/throw-pillow.jpg"),
        ("air-purifier", "public/images/products/home/air-purifier.jpg"),
        ("wall-clock", "public/images/products/home/wall-clock.jpg"),
        ("diffuser", "public/images/products/home/diffuser.jpg"),
        ("curtains", "public/images/products/home/curtains.jpg"),
        ("rug", "public/images/products/home/rug.jpg"),
        ("organizer", "public/images/products/home/organizer.jpg"),
    ],
}


def is_whiteish(r: int, g: int, b: int) -> bool:
    """True for pure white / near-white studio plates — keep light gray/skin."""
    brightness = (r + g + b) / 3
    # Near-white
    if r >= 242 and g >= 242 and b >= 242:
        return True
    # Very bright with low chroma (washed white)
    if brightness >= 248 and max(r, g, b) - min(r, g, b) <= 12:
        return True
    return False


def replace_white_with_skin(im: Image.Image) -> Image.Image:
    im = im.convert("RGB")
    px = im.load()
    assert px is not None
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if is_whiteish(r, g, b):
                px[x, y] = SKIN
    return im


def cover_square(im: Image.Image, size: int, zoom: float = 1.12) -> Image.Image:
    """Center-crop with slight zoom so product fills the circle; then resize."""
    im = im.convert("RGB")
    w, h = im.size
    side = min(w, h)
    zoom_side = max(1, int(side / zoom))
    left = (w - zoom_side) // 2
    top = (h - zoom_side) // 2
    cropped = im.crop((left, top, left + zoom_side, top + zoom_side))
    return cropped.resize((size, size), Image.Resampling.LANCZOS)


def make_circle_tile(src: Path) -> Image.Image:
    """Opaque square: skin fill + product cover. CSS clips to circle — no white bands."""
    base = Image.new("RGB", (SIZE, SIZE), SKIN)
    product = replace_white_with_skin(cover_square(Image.open(src), SIZE, zoom=1.12))
    # Product already fills the square; paste over skin (skin only shows if any
    # remaining edge gaps after white→skin replacement — same color, seamless).
    base.paste(product, (0, 0))
    return base


def content_bbox(im: Image.Image, white_thresh: int = 250) -> tuple[int, int, int, int] | None:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    assert px is not None
    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            if r >= white_thresh and g >= white_thresh and b >= white_thresh:
                continue
            found = True
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)
    if not found:
        return None
    return (min_x, min_y, max_x + 1, max_y + 1)


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
    """For dark lockup: keep logo, drop the solid navy rounded plate + outer white."""
    im = im.convert("RGBA")
    px = im.load()
    assert px is not None
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            # Outer white
            if r >= 248 and g >= 248 and b >= 248:
                px[x, y] = (r, g, b, 0)
                continue
            # Solid navy plate (approx #043868)
            if r < 40 and 40 < g < 90 and 80 < b < 140 and abs(g - 56) < 25:
                # Only clear if it's a flat plate pixel (low variance vs neighbors handled loosely)
                brightness = (r + g + b) / 3
                if brightness < 70 and b > r + 40:
                    px[x, y] = (r, g, b, 0)
    return im


def trim(im: Image.Image, pad: int = 6) -> Image.Image:
    bb = im.getbbox()
    if not bb:
        bb = content_bbox(im)
    if not bb:
        return im
    l, t, r, b = bb
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.width, r + pad)
    b = min(im.height, b + pad)
    return im.crop((l, t, r, b))


def install_logo() -> dict[str, float]:
    if not LOGO_SHEET.exists():
        raise SystemExit(f"Missing logo sheet: {LOGO_SHEET}")
    sheet = Image.open(LOGO_SHEET).convert("RGBA")
    w, h = sheet.size

    # Find split: first row that is predominantly navy
    split = h // 2
    for y in range(h // 3, (2 * h) // 3):
        r, g, b, _a = sheet.getpixel((w // 2, y))
        if r < 40 and b > 80:
            split = y
            break

    light = trim(white_to_transparent(sheet.crop((0, 0, w, split))))
    dark_raw = sheet.crop((0, split, w, h))
    dark = trim(navy_plate_to_transparent(dark_raw))

    # Header: drop tagline (~bottom 26%)
    cut = int(light.height * 0.74)
    header = trim(light.crop((0, 0, light.width, cut)))
    cut_d = int(dark.height * 0.74)
    header_dark = trim(dark.crop((0, 0, dark.width, cut_d)))

    BRAND.mkdir(parents=True, exist_ok=True)
    paths = {
        "light": BRAND / "importnest-logo-light.png",
        "dark": BRAND / "importnest-logo-dark.png",
        "header": BRAND / "importnest-header-logo-v3.png",
        "header_v2": BRAND / "importnest-header-logo-v2.png",
        "header_dark": BRAND / "importnest-header-logo-dark.png",
        "transparent": BRAND / "logo9-transparent.png",
        "on_dark": BRAND / "logo9-on-dark.png",
    }
    light.save(paths["light"], "PNG", optimize=True)
    dark.save(paths["dark"], "PNG", optimize=True)
    header.save(paths["header"], "PNG", optimize=True)
    shutil.copyfile(paths["header"], paths["header_v2"])
    header_dark.save(paths["header_dark"], "PNG", optimize=True)
    light.save(paths["transparent"], "PNG", optimize=True)
    dark.save(paths["on_dark"], "PNG", optimize=True)

    aspects = {
        "header": header.width / max(1, header.height),
        "light": light.width / max(1, light.height),
        "dark": dark.width / max(1, dark.height),
    }
    print(f"Logo split@{split}: header {header.size} aspect={aspects['header']:.3f}")
    print(f"  light {light.size}  dark {dark.size}")
    return aspects


def rebuild_tiles() -> None:
    made = 0
    missing: list[str] = []
    for cat, items in SOURCES.items():
        dest = OUT / cat
        dest.mkdir(parents=True, exist_ok=True)
        for slug, src in items:
            src_path = ROOT / src
            if not src_path.exists():
                missing.append(src)
                continue
            out = dest / f"{slug}.png"
            make_circle_tile(src_path).save(out, "PNG", optimize=True)
            made += 1
            print(f"OK {out.relative_to(ROOT)}")
    print(f"\nRebuilt {made} skin-fill circle tiles")
    if missing:
        print("MISSING:", missing)
        raise SystemExit(1)


def main() -> None:
    aspects = install_logo()
    (ROOT / "scripts" / ".logo-aspects.txt").write_text(
        f"headerAspect={aspects['header']:.4f}\n"
        f"horizontalAspect={aspects['light']:.4f}\n"
        f"darkAspect={aspects['dark']:.4f}\n",
        encoding="utf-8",
    )
    rebuild_tiles()


if __name__ == "__main__":
    main()
