"""
WisBees — Birthday Banner Generator
Generates high-resolution celebratory banners for employees, admins, HR, and leaders.
"""

import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def create_birthday_banner(name="Jnana Sir", title="Founder & Director", output_path=None):
    """
    Creates a luxury corporate celebratory birthday banner (1200 x 630 px).
    Theme: WisBees Midnight Navy (#06101e), Royal Gold (#d4af37, #f6e082), White (#ffffff).
    """
    width, height = 1200, 630
    img = Image.new("RGBA", (width, height), (6, 16, 30, 255))
    draw = ImageDraw.Draw(img)

    # 1. Subtle radial/vertical background gradient
    for y in range(height):
        ratio = y / float(height)
        r = int(6 + (14 - 6) * ratio)
        g = int(16 + (32 - 16) * ratio)
        b = int(30 + (58 - 30) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))

    # 2. Luxury Gold Frame Border
    border_margin = 28
    gold_outer = (212, 175, 55, 255)
    gold_inner = (246, 224, 130, 180)
    draw.rectangle(
        [(border_margin, border_margin), (width - border_margin, height - border_margin)],
        outline=gold_outer,
        width=3
    )
    draw.rectangle(
        [(border_margin + 8, border_margin + 8), (width - border_margin - 8, height - border_margin - 8)],
        outline=gold_inner,
        width=1
    )

    # 3. Corner accents (Flourish diamonds)
    corner_coords = [
        (border_margin + 8, border_margin + 8),
        (width - border_margin - 8, border_margin + 8),
        (border_margin + 8, height - border_margin - 8),
        (width - border_margin - 8, height - border_margin - 8)
    ]
    for cx, cy in corner_coords:
        d = 6
        draw.polygon([(cx, cy - d), (cx + d, cy), (cx, cy + d), (cx - d, cy)], fill=gold_outer)

    # 4. Celebratory Sparkles / Confetti Dots
    import random
    random.seed(42)  # Consistent decorative particle pattern
    for _ in range(75):
        px = random.randint(border_margin + 20, width - border_margin - 20)
        py = random.randint(border_margin + 20, height - border_margin - 20)
        size = random.choice([2, 3, 4])
        alpha = random.randint(100, 230)
        color = random.choice([
            (212, 175, 55, alpha),
            (246, 224, 130, alpha),
            (255, 255, 255, alpha),
            (99, 179, 237, alpha)
        ])
        draw.ellipse([px - size, py - size, px + size, py + size], fill=color)

    # 5. Fonts setup (Fallback to default if custom ttf not present)
    font_large = None
    font_medium = None
    font_sub = None
    font_small = None

    try:
        # Check standard Windows fonts
        font_large = ImageFont.truetype("arialbd.ttf", 64)
        font_name = ImageFont.truetype("georgiab.ttf", 54)
        font_sub = ImageFont.truetype("arial.ttf", 26)
        font_small = ImageFont.truetype("arialbd.ttf", 20)
    except Exception:
        font_large = ImageFont.load_default()
        font_name = font_large
        font_sub = font_large
        font_small = font_large

    # 6. Text Header
    top_label = "—  WISBEES CELEBRATES  —"
    try:
        bbox = draw.textbbox((0, 0), top_label, font=font_small)
        w = bbox[2] - bbox[0]
    except Exception:
        w = 200
    draw.text(((width - w) / 2, 85), top_label, fill=(212, 175, 55), font=font_small)

    # 7. Main Happy Birthday Heading
    main_title = "HAPPY BIRTHDAY"
    try:
        bbox = draw.textbbox((0, 0), main_title, font=font_large)
        w = bbox[2] - bbox[0]
    except Exception:
        w = 400
    # Gold text shadow for depth
    draw.text(((width - w) / 2 + 2, 142), main_title, fill=(30, 25, 10), font=font_large)
    draw.text(((width - w) / 2, 140), main_title, fill=(246, 224, 130), font=font_large)

    # 8. Person's Name with elegant vector gold stars on each side
    name_text = f"{name}"
    try:
        bbox = draw.textbbox((0, 0), name_text, font=font_name)
        w = bbox[2] - bbox[0]
        h_name = bbox[3] - bbox[1]
    except Exception:
        w = 300
        h_name = 50
    name_x = (width - w) / 2
    name_y = 235
    draw.text((name_x, name_y), name_text, fill=(255, 255, 255), font=font_name)

    # Draw sharp metallic 4-point gold stars next to the name
    star_offset = 45
    center_y = name_y + h_name / 2 + 5
    for star_cx in [name_x - star_offset, name_x + w + star_offset]:
        s_rad = 12
        draw.polygon([
            (star_cx, center_y - s_rad),
            (star_cx + 4, center_y - 4),
            (star_cx + s_rad, center_y),
            (star_cx + 4, center_y + 4),
            (star_cx, center_y + s_rad),
            (star_cx - 4, center_y + 4),
            (star_cx - s_rad, center_y),
            (star_cx - 4, center_y - 4)
        ], fill=(246, 224, 130))
        # Small center diamond
        draw.polygon([
            (star_cx, center_y - 4),
            (star_cx + 4, center_y),
            (star_cx, center_y + 4),
            (star_cx - 4, center_y)
        ], fill=(212, 175, 55))

    # 9. Divider Line
    line_w = 420
    draw.line([((width - line_w) / 2, 320), ((width + line_w) / 2, 320)], fill=(212, 175, 55), width=2)
    draw.polygon([(width / 2, 314), (width / 2 + 6, 320), (width / 2, 326), (width / 2 - 6, 320)], fill=(246, 224, 130))

    # 10. Wishes Subtitle
    wish_line1 = "Wishing you a year filled with vision, milestone success,"
    wish_line2 = "great health, and boundless joy in all your endeavors!"
    try:
        bbox1 = draw.textbbox((0, 0), wish_line1, font=font_sub)
        w1 = bbox1[2] - bbox1[0]
        bbox2 = draw.textbbox((0, 0), wish_line2, font=font_sub)
        w2 = bbox2[2] - bbox2[0]
    except Exception:
        w1, w2 = 400, 400
    draw.text(((width - w1) / 2, 355), wish_line1, fill=(226, 232, 240), font=font_sub)
    draw.text(((width - w2) / 2, 395), wish_line2, fill=(203, 213, 225), font=font_sub)

    # 11. Footer Signature
    footer_text = "— WITH WARMEST REGARDS FROM TEAM WISBEES —"
    try:
        bbox_f = draw.textbbox((0, 0), footer_text, font=font_small)
        wf = bbox_f[2] - bbox_f[0]
    except Exception:
        wf = 300
    draw.text(((width - wf) / 2, 510), footer_text, fill=(212, 175, 55), font=font_small)

    if output_path:
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        img.convert("RGB").save(str(out), "PNG", quality=95)
        return str(out)

    return img


if __name__ == "__main__":
    banner_file = Path(__file__).resolve().parent.parent / "static" / "birthday" / "banner.png"
    create_birthday_banner("Jnana Sir", output_path=banner_file)
    print(f"Generated banner at: {banner_file}")
