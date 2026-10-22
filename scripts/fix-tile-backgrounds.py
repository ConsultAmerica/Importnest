"""Rebuild problem circle tiles: rembg cutout + contrast fill.

White/silver products were blending into (or being eaten by) skin fills.
Uses rembg for a clean subject mask, then composites onto a per-tile fill.
"""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image
from rembg import remove

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "images" / "subtypes"
SIZE = 512

# Cooler / deeper fills so white & silver products read clearly in the circle
FILLS: dict[tuple[str, str], tuple[int, int, int]] = {
    ("electronics", "earbuds"): (74, 92, 112),          # deep slate
    ("appliances", "refrigerator"): (90, 104, 120),     # cool charcoal-blue
    ("appliances", "freezer"): (82, 96, 112),
    ("appliances", "washing-machine"): (82, 96, 112),
    ("appliances", "air-purifier"): (88, 100, 118),
    ("footwear", "casual-shoe"): (78, 86, 98),          # charcoal
    ("beauty", "hair-dryer"): (220, 226, 232),         # cool light gray (rose gold pops)
    ("beauty", "skincare-fridge"): (245, 236, 230),     # warm cream (blue door pops)
    ("beauty", "led-mirror"): (72, 84, 100),            # deep slate for silver
    ("home", "air-purifier"): (88, 100, 118),           # slate (white + purple)
    ("home", "organizer"): (108, 100, 92),              # warm taupe (wood + white)
}

SOURCES: dict[tuple[str, str], str] = {
    ("electronics", "earbuds"): "public/images/products/electronics/earbuds.jpg",
    ("appliances", "refrigerator"): "public/images/products/appliances/refrigerator.jpg",
    ("appliances", "freezer"): "public/images/products/appliances/freezer.jpg",
    ("appliances", "washing-machine"): "public/images/products/appliances/washing-machine.jpg",
    ("appliances", "air-purifier"): "public/images/products/appliances/air-purifier.jpg",
    ("footwear", "casual-shoe"): "public/images/products/footwear/casual-shoe.jpg",
    ("beauty", "hair-dryer"): "public/images/products/beauty/hair-dryer.jpg",
    ("beauty", "skincare-fridge"): "public/images/products/beauty/skincare-fridge.jpg",
    ("beauty", "led-mirror"): "public/images/products/beauty/led-mirror.jpg",
    ("home", "air-purifier"): "public/images/products/home/air-purifier.jpg",
    ("home", "organizer"): "public/images/products/home/organizer.jpg",
}


def cover_rgba(im: Image.Image, size: int, zoom: float = 1.08) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    side = min(w, h)
    zs = max(1, int(side / zoom))
    left = (w - zs) // 2
    top = (h - zs) // 2
    return im.crop((left, top, left + zs, top + zs)).resize((size, size), Image.Resampling.LANCZOS)


def cutout(src: Path) -> Image.Image:
    raw = Image.open(src).convert("RGBA")
    # rembg expects bytes or PIL; returns PNG bytes with alpha
    out_bytes = remove(raw)
    if isinstance(out_bytes, (bytes, bytearray)):
        return Image.open(BytesIO(out_bytes)).convert("RGBA")
    return out_bytes.convert("RGBA")


def trim_alpha(im: Image.Image, pad: int = 12) -> Image.Image:
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


def fit_on_fill(cut: Image.Image, fill: tuple[int, int, int], size: int = SIZE) -> Image.Image:
    """Center the cutout on a solid fill, slightly padded inside the square."""
    cut = trim_alpha(cut)
    # Scale to fit with ~10% padding
    max_side = int(size * 0.88)
    cw, ch = cut.size
    scale = min(max_side / max(1, cw), max_side / max(1, ch))
    nw = max(1, int(cw * scale))
    nh = max(1, int(ch * scale))
    cut = cut.resize((nw, nh), Image.Resampling.LANCZOS)

    base = Image.new("RGBA", (size, size), (*fill, 255))
    x = (size - nw) // 2
    y = (size - nh) // 2
    base.alpha_composite(cut, (x, y))
    return base.convert("RGB")


def make_tile(src: Path, fill: tuple[int, int, int]) -> Image.Image:
    cut = cutout(src)
    return fit_on_fill(cut, fill)


def main() -> None:
    for (cat, slug), rel in SOURCES.items():
        src = ROOT / rel
        if not src.exists():
            print("MISSING", rel)
            continue
        fill = FILLS[(cat, slug)]
        out_dir = OUT / cat
        out_dir.mkdir(parents=True, exist_ok=True)
        out = out_dir / f"{slug}.png"
        print(f"Cutting {cat}/{slug}...")
        make_tile(src, fill).save(out, "PNG", optimize=True)
        print(f"  OK fill=#{fill[0]:02X}{fill[1]:02X}{fill[2]:02X} -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
