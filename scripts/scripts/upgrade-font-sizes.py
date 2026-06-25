#!/usr/bin/env python3
"""Upgrade all font sizes in game scenes by 1.5x for better readability."""
import re
import os
import glob

SCENES_DIR = '/home/z/my-project/src/game/scenes'
JUICE_FILE = '/home/z/my-project/src/game/Juice.ts'

def upgrade_font_sizes(filepath, multiplier=1.5):
    """Find all fontSize: 'NNpx' and multiply by multiplier, rounded to nearest int."""
    with open(filepath, 'r') as f:
        content = f.read()

    def replace_font_size(match):
        full = match.group(0)
        size = int(match.group(1))
        new_size = round(size * multiplier)
        # Cap at 48px to prevent absurd sizes
        new_size = min(new_size, 48)
        return full.replace(f"'{size}px'", f"'{new_size}px'")

    # Match fontSize: 'NNpx' (with single quotes)
    pattern = r"fontSize:\s*'(\d+)px'"
    new_content = re.sub(pattern, replace_font_size, content)

    # Also match fontSize: "NNpx" (with double quotes, rare)
    pattern2 = r'fontSize:\s*"(\d+)px"'
    new_content = re.sub(pattern2, lambda m: m.group(0).replace(f'"{m.group(1)}px"', f'"{round(int(m.group(1))*multiplier)}px"'), new_content)

    # Also match { fontSize: (NN + ...) + 'px' } dynamic patterns — leave these alone
    with open(filepath, 'w') as f:
        f.write(new_content)

    changes = len(re.findall(pattern, content))
    return changes

# Process all scene files
scene_files = glob.glob(os.path.join(SCENES_DIR, '*.ts'))
total_changes = 0
for f in scene_files:
    changes = upgrade_font_sizes(f)
    print(f"  {os.path.basename(f)}: {changes} font sizes upgraded")
    total_changes += changes

# Process Juice.ts (HUD, mascots, etc.)
changes = upgrade_font_sizes(JUICE_FILE)
print(f"  Juice.ts: {changes} font sizes upgraded")
total_changes += changes

print(f"\nTotal: {total_changes} font sizes upgraded across {len(scene_files)+1} files")
