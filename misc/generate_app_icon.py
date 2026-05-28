"""Generate app icons for Song Notations mobile app.

Uses the same Lucide 'music' icon as the Vercel platform app header:
  <path d="M9 18V5l12-2v13"/>
  <circle cx="6" cy="18" r="3"/>
  <circle cx="18" cy="16" r="3"/>
"""
from PIL import Image, ImageDraw
import math
import os

SIZE = 1024
CENTER = SIZE // 2


def create_icon():
    """Create a 1024x1024 app icon matching the Vercel app's music icon."""
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded-square background with the same accent purple
    # Fill with solid accent color (matches the header icon box)
    corner_radius = 220
    draw.rounded_rectangle(
        [0, 0, SIZE, SIZE],
        radius=corner_radius,
        fill=(108, 99, 255, 255),
    )

    # Subtle gradient overlay (lighter at top-left, darker at bottom-right)
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for y in range(SIZE):
        for x in range(SIZE):
            # Diagonal gradient
            t = (x + y) / (2 * SIZE)
            alpha = int(t * 50)
            overlay.putpixel((x, y), (0, 0, 0, alpha))
    img = Image.alpha_composite(img, overlay)
    draw = ImageDraw.Draw(img)

    # Draw the Lucide music icon scaled to fit
    # Original viewBox: 0 0 24 24
    # Scale to fit inside icon with padding
    padding = 200
    scale = (SIZE - 2 * padding) / 24.0
    ox, oy = padding, padding  # offset

    def sx(x):
        return ox + x * scale

    def sy(y):
        return oy + y * scale

    stroke_color = (255, 255, 255, 255)
    stroke_width = int(2 * scale * 0.85)  # scale stroke proportionally

    # Path: M9 18V5l12-2v13
    # Line from (9,5) to (9,18) - left stem
    draw.line([(sx(9), sy(5)), (sx(9), sy(18))], fill=stroke_color, width=stroke_width)
    # Line from (9,5) to (21,3) - top connecting bar
    draw.line([(sx(9), sy(5)), (sx(21), sy(3))], fill=stroke_color, width=stroke_width)
    # Line from (21,3) to (21,16) - right stem
    draw.line([(sx(21), sy(3)), (sx(21), sy(16))], fill=stroke_color, width=stroke_width)

    # Circle at (6, 18) r=3 - left note head
    r = 3 * scale
    cx1, cy1 = sx(6), sy(18)
    draw.ellipse(
        [cx1 - r, cy1 - r, cx1 + r, cy1 + r],
        outline=stroke_color,
        width=stroke_width,
    )
    # Fill the note heads for better visibility at small sizes
    inner_r = r - stroke_width // 2
    if inner_r > 0:
        draw.ellipse(
            [cx1 - inner_r, cy1 - inner_r, cx1 + inner_r, cy1 + inner_r],
            fill=stroke_color,
        )

    # Circle at (18, 16) r=3 - right note head
    cx2, cy2 = sx(18), sy(16)
    draw.ellipse(
        [cx2 - r, cy2 - r, cx2 + r, cy2 + r],
        outline=stroke_color,
        width=stroke_width,
    )
    if inner_r > 0:
        draw.ellipse(
            [cx2 - inner_r, cy2 - inner_r, cx2 + inner_r, cy2 + inner_r],
            fill=stroke_color,
        )

    return img


def create_adaptive_icon(img):
    """Create adaptive icon with safe zone padding."""
    # Android adaptive icons need 108dp with 72dp safe zone
    # Add padding around the foreground
    padded = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    # Scale down and center
    inner_size = int(SIZE * 0.72)
    resized = img.resize((inner_size, inner_size), Image.LANCZOS)
    offset = (SIZE - inner_size) // 2
    padded.paste(resized, (offset, offset))
    return padded


def create_splash():
    """Create a splash screen (1284x2778)."""
    W, H = 1284, 2778
    splash = Image.new("RGBA", (W, H), (26, 26, 46, 255))
    draw = ImageDraw.Draw(splash)

    # Gradient background
    for y in range(H):
        ratio = y / H
        r = int(26 + 15 * math.sin(ratio * math.pi))
        g = int(26 + 10 * math.sin(ratio * math.pi))
        b = int(46 + 30 * math.sin(ratio * math.pi))
        draw.line([(0, y), (W, y)], fill=(r, g, b, 255))

    # Center the icon
    icon = create_icon()
    icon_size = 400
    small_icon = icon.resize((icon_size, icon_size), Image.LANCZOS)
    splash.paste(small_icon, (W // 2 - icon_size // 2, H // 2 - icon_size // 2 - 100), small_icon)

    # App name
    try:
        font_paths = [
            "/System/Library/Fonts/Helvetica.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ]
        font = None
        for fp in font_paths:
            if os.path.exists(fp):
                font = ImageFont.truetype(fp, 64)
                break
        if font is None:
            font = ImageFont.load_default()
    except Exception:
        font = ImageFont.load_default()

    text = "Song Notations"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    draw.text(
        (W // 2 - tw // 2, H // 2 + icon_size // 2),
        text,
        fill=(255, 255, 255, 200),
        font=font,
    )

    return splash


if __name__ == "__main__":
    assets_dir = os.path.join(os.path.dirname(__file__), "..", "mobile-app", "assets")

    print("Generating app icon...")
    icon = create_icon()
    icon.save(os.path.join(assets_dir, "icon.png"))
    print(f"  Saved icon.png (1024x1024)")

    print("Generating adaptive icon...")
    adaptive = create_adaptive_icon(icon)
    adaptive.save(os.path.join(assets_dir, "adaptive-icon.png"))
    print(f"  Saved adaptive-icon.png (1024x1024)")

    print("Generating splash screen...")
    splash = create_splash()
    splash.save(os.path.join(assets_dir, "splash.png"))
    print(f"  Saved splash.png (1284x2778)")

    # Also save a web favicon for the platform
    platform_public = os.path.join(os.path.dirname(__file__), "..", "platform", "public")
    if os.path.isdir(platform_public):
        favicon = icon.resize((512, 512), Image.LANCZOS)
        favicon.save(os.path.join(platform_public, "icon-512.png"))
        favicon_small = icon.resize((192, 192), Image.LANCZOS)
        favicon_small.save(os.path.join(platform_public, "icon-192.png"))
        print(f"  Saved platform icons (512, 192)")

    print("Done!")
