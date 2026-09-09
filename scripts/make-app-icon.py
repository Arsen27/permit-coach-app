#!/usr/bin/env python3
"""Renders the app icon at every platform size from vector geometry.

The artwork is the road mark supplied as assets/128x128.png. That export is
far too small for a 1024pt App Store icon (an 8x upscale turns the lane lines
to mush), so the shapes are reproduced here as geometry — measured off the
original — and rasterised at whatever size is asked for.

Everything draws at 4x and downsamples, which gives clean antialiasing without
needing an SVG rasteriser (none is installed).

    python3 scripts/make-app-icon.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent

# Colours sampled from the source export.
BACKGROUND = (0, 153, 101, 255)  # #009965
LANE_EDGE = (166, 219, 201, 255)  # #A6DBC9
CENTRE_DASH = (217, 240, 232, 255)  # #D9F0E8
RING = (109, 196, 166, 255)  # #6DC4A6
RING_FILL = (255, 255, 255, 255)

# The mark is defined in the source's own 128x128 space.
VIEWBOX = 128.0
AXIS = 64.0  # centre line of the road
CORNER_RADIUS = 32.0

# Lane edges: (top point, top half-width) → (bottom point, bottom half-width).
# They taper with perspective, so each is drawn as a tapered band, mirrored
# about the axis.
LANE_TOP = (45.0, 31.5, 1.2)  # x, y, half-width
LANE_BOTTOM = (24.2, 94.5, 4.0)

# Centre dashes: (top y, bottom y, top half-width, bottom half-width).
DASHES = (
    (31.5, 38.5, 1.8, 2.0),
    (53.0, 64.5, 2.0, 2.2),
    (85.0, 96.5, 2.4, 3.0),
)

# The two stops on the road: (centre y, ring rx, ring ry, fill rx, fill ry).
STOPS = (
    (45.0, 7.0, 5.4, 5.2, 3.8),
    (74.5, 9.0, 6.7, 7.2, 5.6),
)

SUPERSAMPLE = 4


def rounded_rect_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size - 1, size - 1), radius=radius, fill=255
    )
    return mask


def tapered_band(draw, x0, y0, w0, x1, y1, w1, fill, steps=260):
    """A straight stroke whose width changes along its length, with round
    ends — Pillow has no such primitive, so it is stamped from discs."""
    for i in range(steps + 1):
        t = i / steps
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        r = w0 + (w1 - w0) * t
        draw.ellipse((x - r, y - r, x + r, y + r), fill=fill)


def ellipse(draw, cx, cy, rx, ry, fill=None, outline=None, width=1):
    draw.ellipse(
        (cx - rx, cy - ry, cx + rx, cy + ry),
        fill=fill,
        outline=outline,
        width=width,
    )


def render(size, *, background=True, inset=1.0):
    """Square icon at `size`. `inset` scales the artwork down inside the tile
    (Android adaptive foregrounds need the safe zone); `background=False`
    drops the green plate for that same adaptive foreground layer."""
    canvas = size * SUPERSAMPLE
    image = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    scale = canvas / VIEWBOX * inset
    offset = (canvas - VIEWBOX * scale) / 2

    def px(value):
        return value * scale

    def pt(x, y):
        return offset + x * scale, offset + y * scale

    if background:
        # Full-bleed: the platforms apply their own corner mask, so baking
        # rounded corners in (as the source export does) would double up.
        draw.rectangle((0, 0, canvas, canvas), fill=BACKGROUND)

    lx, ly, lw = LANE_TOP
    bx, by, bw = LANE_BOTTOM
    for sign in (-1, 1):
        x0, y0 = pt(AXIS + sign * (AXIS - lx), ly)
        x1, y1 = pt(AXIS + sign * (AXIS - bx), by)
        tapered_band(draw, x0, y0, px(lw), x1, y1, px(bw), LANE_EDGE)

    for top, bottom, w_top, w_bottom in DASHES:
        x0, y0 = pt(AXIS, top)
        x1, y1 = pt(AXIS, bottom)
        tapered_band(draw, x0, y0, px(w_top), x1, y1, px(w_bottom), CENTRE_DASH)

    for cy, rx, ry, fx, fy in STOPS:
        cx, y = pt(AXIS, cy)
        ellipse(
            draw,
            cx,
            y,
            px(rx),
            px(ry),
            outline=RING,
            width=max(1, round(px(1.1))),
        )
        ellipse(draw, cx, y, px(fx), px(fy), fill=RING_FILL)

    return image.resize((size, size), Image.LANCZOS)


def write(image, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG")
    print(f"  {path.relative_to(ROOT)}  {image.width}x{image.height}")


def round_mask(image):
    """Android's ic_launcher_round wants a circular icon."""
    size = image.width
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    out = image.copy()
    out.putalpha(mask.resize((size, size), Image.LANCZOS))
    return out


def main():
    print("iOS:")
    ios = ROOT / "ios/DmvLearning/Images.xcassets/AppIcon.appiconset"
    # One 1024pt image; iOS masks the corners itself. No alpha channel — the
    # App Store rejects icons that carry one.
    write(render(1024).convert("RGB"), ios / "AppIcon-1024.png")

    print("Android:")
    res = ROOT / "android/app/src/main/res"
    for folder, size in (
        ("mipmap-mdpi", 48),
        ("mipmap-hdpi", 72),
        ("mipmap-xhdpi", 96),
        ("mipmap-xxhdpi", 144),
        ("mipmap-xxxhdpi", 192),
    ):
        # Legacy launchers do not mask, so these keep the rounded corners.
        square = render(size)
        rounded = square.copy()
        rounded.putalpha(rounded_rect_mask(size, round(size * CORNER_RADIUS / VIEWBOX)))
        write(rounded, res / folder / "ic_launcher.png")
        write(round_mask(square), res / folder / "ic_launcher_round.png")

    # Adaptive icon (API 26+): the launcher masks and can zoom the foreground,
    # so the artwork sits inside the 66% safe zone over a flat green plate.
    for folder, size in (
        ("mipmap-mdpi", 108),
        ("mipmap-hdpi", 162),
        ("mipmap-xhdpi", 216),
        ("mipmap-xxhdpi", 324),
        ("mipmap-xxxhdpi", 432),
    ):
        write(
            render(size, background=False, inset=0.62),
            res / folder / "ic_launcher_foreground.png",
        )


if __name__ == "__main__":
    main()
