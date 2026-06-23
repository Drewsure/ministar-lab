#!/usr/bin/env python3
"""Generate PNG icons from the MiniStar SVG icon at multiple sizes."""
import subprocess
from pathlib import Path

PUBLIC_DIR = Path('/home/z/my-project/public')
SVG_PATH = PUBLIC_DIR / 'icon.svg'

# Sizes to generate
SIZES = [192, 512]

def generate_png(size: int, output_path: Path, maskable: bool = False):
    """Generate a PNG from the SVG using rsvg-convert or cairosvg."""
    try:
        if maskable:
            # For maskable icons, add padding so the icon isn't cropped
            # on Android (safe zone is 80% of canvas)
            cmd = [
                'rsvg-convert', '-w', str(size), '-h', str(size),
                '-b', '#7c3aed',  # background fill for maskable
                '-f', 'png',
                '-o', str(output_path),
                str(SVG_PATH)
            ]
        else:
            cmd = [
                'rsvg-convert', '-w', str(size), '-h', str(size),
                '-b', '#05030f',  # background fill
                '-f', 'png',
                '-o', str(output_path),
                str(SVG_PATH)
            ]
        subprocess.run(cmd, check=True, capture_output=True)
        print(f'Generated {output_path}')
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        # Fallback: use cairosvg
        try:
            import cairosvg
            if maskable:
                # For maskable, just render with a solid bg color (safe zone handled by OS)
                cairosvg.svg2png(url=str(SVG_PATH), write_to=str(output_path),
                                output_width=size, output_height=size, background_color='#7c3aed')
            else:
                cairosvg.svg2png(url=str(SVG_PATH), write_to=str(output_path),
                                output_width=size, output_height=size, background_color='#05030f')
            print(f'Generated {output_path} (cairosvg)')
            return True
        except Exception as e:
            print(f'Failed {output_path}: {e}')
            return False

def main():
    if not SVG_PATH.exists():
        print(f'Error: {SVG_PATH} not found')
        return

    for size in SIZES:
        # Regular icons
        generate_png(size, PUBLIC_DIR / f'icon-{size}.png', maskable=False)
        # Maskable icons (with background fill)
        generate_png(size, PUBLIC_DIR / f'icon-maskable-{size}.png', maskable=True)

    print('Done!')

if __name__ == '__main__':
    main()
