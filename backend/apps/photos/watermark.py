import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageEnhance
from django.conf import settings
from apps.site_settings.models import SiteSetting

def apply_watermark(base_image: Image.Image, watermark_settings: dict = None) -> Image.Image:
    """
    Burns a watermark into a Pillow image according to watermark settings.
    Supports text watermarking and image logo watermarking.
    """
    if watermark_settings is None:
        watermark_settings = SiteSetting.get_setting('watermark')

    if not watermark_settings or not watermark_settings.get('enabled', False):
        return base_image

    wm_type = watermark_settings.get('type', 'text')
    position = watermark_settings.get('position', 'bottom-right')
    opacity = max(0.1, min(1.0, watermark_settings.get('opacity', 60) / 100.0))
    scale = max(0.1, min(0.6, watermark_settings.get('scale', 20) / 100.0))

    img_w, img_h = base_image.size
    # Work on RGBA copy for clean transparency compositing
    rgba_image = base_image.convert('RGBA')
    watermark_layer = Image.new('RGBA', rgba_image.size, (0, 0, 0, 0))

    if wm_type == 'image' and watermark_settings.get('image_key'):
        logo_path = Path(settings.MEDIA_ROOT) / watermark_settings['image_key']
        if logo_path.exists():
            try:
                logo = Image.open(logo_path).convert('RGBA')
                # Scale logo relative to image width
                target_w = int(img_w * scale)
                ratio = target_w / float(logo.size[0])
                target_h = int(logo.size[1] * ratio)
                logo = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)

                # Adjust logo opacity
                alpha = logo.split()[3]
                alpha = ImageEnhance.Brightness(alpha).enhance(opacity)
                logo.putalpha(alpha)

                # Compute position
                pos_x, pos_y = calculate_position(img_w, img_h, target_w, target_h, position)
                watermark_layer.paste(logo, (pos_x, pos_y), logo)
                return Image.alpha_composite(rgba_image, watermark_layer).convert('RGB')
            except Exception:
                pass # Fallback to text if logo fails to load

    # Text Watermark Fallback / Default
    text = watermark_settings.get('text', 'Wedding Studio').strip()
    if not text:
        return base_image

    draw = ImageDraw.Draw(watermark_layer)
    font_size = max(16, int(img_w * scale * 0.25))

    try:
        # Try loading default sans or serif font
        font = ImageFont.truetype("arial.ttf", font_size)
    except Exception:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except Exception:
            font = ImageFont.load_default()

    # Calculate text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    pos_x, pos_y = calculate_position(img_w, img_h, text_w, text_h, position)

    # Draw semi-transparent shadow for contrast, then main text
    shadow_color = (0, 0, 0, int(180 * opacity))
    text_color = (255, 255, 255, int(255 * opacity))

    draw.text((pos_x + 2, pos_y + 2), text, font=font, fill=shadow_color)
    draw.text((pos_x, pos_y), text, font=font, fill=text_color)

    return Image.alpha_composite(rgba_image, watermark_layer).convert('RGB')


def calculate_position(canvas_w: int, canvas_h: int, element_w: int, element_h: int, position: str) -> tuple[int, int]:
    """Calculates top-left coordinates with standard padding."""
    pad_x = int(canvas_w * 0.04)
    pad_y = int(canvas_h * 0.04)

    if position == 'top-left':
        return (pad_x, pad_y)
    elif position == 'top-right':
        return (canvas_w - element_w - pad_x, pad_y)
    elif position == 'bottom-left':
        return (pad_x, canvas_h - element_h - pad_y)
    elif position == 'center':
        return ((canvas_w - element_w) // 2, (canvas_h - element_h) // 2)
    else: # 'bottom-right'
        return (canvas_w - element_w - pad_x, canvas_h - element_h - pad_y)
