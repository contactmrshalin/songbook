"""Generate app icons for Song Notations mobile app."""
from PIL import Image, ImageDraw, ImageFont
import math
import os

SIZE = 1024
CENTER = SIZE // 2

def create_icon():
    """Create a 1024x1024 app icon with gradient background and musical symbols."""
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Gradient background: deep purple to indigo
    for y in range(SIZE):
        ratio = y / SIZE
        # Radial-ish gradient from center
        r = int(26 + (108 - 26) * (1 - ratio) * 0.3)
        g = int(26 + (99 - 26) * (1 - ratio) * 0.2)
        b = int(46 + (255 - 46) * (1 - ratio) * 0.4)
        for x in range(SIZE):
            # Radial component
            dx = (x - CENTER) / CENTER
            dy = (y - CENTER) / CENTER
            dist = math.sqrt(dx * dx + dy * dy)
            radial = max(0, 1 - dist * 0.8)
            rr = int(r + (108 - r) * radial * 0.5)
            gg = int(g + (99 - g) * radial * 0.3)
            bb = int(b + (255 - b) * radial * 0.6)
            img.putpixel((x, y), (rr, gg, bb, 255))

    # Draw a rounded rectangle background for cleaner look
    # (icon masking handles corners, but let's add an inner glow)

    # Draw decorative staff lines (subtle)
    staff_color = (255, 255, 255, 25)
    for i in range(5):
        y_pos = 350 + i * 70
        draw.line([(100, y_pos), (924, y_pos)], fill=staff_color, width=3)

    # Draw a large treble clef / musical note symbol
    # We'll draw a stylized "Sa" in Devanagari-inspired style + musical note

    # Musical note (eighth note) - large and centered
    note_color = (255, 255, 255, 240)

    # Note head (filled ellipse)
    note_cx, note_cy = CENTER - 40, CENTER + 80
    draw.ellipse(
        [note_cx - 70, note_cy - 50, note_cx + 70, note_cy + 50],
        fill=note_color,
    )

    # Note stem
    stem_x = note_cx + 65
    draw.rectangle([stem_x, note_cy - 280, stem_x + 12, note_cy], fill=note_color)

    # Note flag (curved)
    flag_points = []
    for t in range(30):
        tt = t / 29.0
        fx = stem_x + 12 + math.sin(tt * math.pi) * 60
        fy = note_cy - 280 + tt * 140
        flag_points.append((fx, fy))
    # Draw flag as thick lines
    for i in range(len(flag_points) - 1):
        draw.line([flag_points[i], flag_points[i + 1]], fill=note_color, width=14)

    # Draw "Sa" text below the note
    sa_color = (108, 99, 255, 255)  # Accent purple
    try:
        # Try system fonts
        font_paths = [
            "/System/Library/Fonts/Helvetica.ttc",
            "/System/Library/Fonts/SFNSDisplay.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ]
        font = None
        for fp in font_paths:
            if os.path.exists(fp):
                font = ImageFont.truetype(fp, 180)
                break
        if font is None:
            font = ImageFont.load_default()
    except Exception:
        font = ImageFont.load_default()

    # "Sa" text at bottom
    text = "Sa"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        (CENTER - tw // 2, SIZE - 250),
        text,
        fill=(255, 255, 255, 220),
        font=font,
    )

    # Subtle glow ring around center
    for r in range(200, 260, 4):
        alpha = int(30 * (1 - (r - 200) / 60))
        glow_color = (108, 99, 255, alpha)
        draw.ellipse(
            [CENTER - r, CENTER - r, CENTER + r, CENTER + r],
            outline=glow_color,
            width=2,
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
