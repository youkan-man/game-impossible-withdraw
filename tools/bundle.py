#!/usr/bin/env python3
"""Produce a dependency-free HTML build (including file:// usage)."""
from pathlib import Path
import argparse

ROOT = Path(__file__).resolve().parents[1]

def build(output: Path) -> None:
    text = (ROOT / 'index.html').read_text(encoding='utf-8')
    text = text.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + (ROOT / 'styles.css').read_text(encoding='utf-8') + '\n</style>')
    text = text.replace('<link rel="stylesheet" href="labyrinth.css">', '<style>\n' + (ROOT / 'labyrinth.css').read_text(encoding='utf-8') + '\n</style>')
    for name in ('labyrinth.js', 'game.js', 'save.js', 'labyrinth-ui.js', 'app.js'):
        source = (ROOT / name).read_text(encoding='utf-8').replace('</script', '<\\/script')
        text = text.replace(f'<script src="{name}"></script>', f'<script>\n{source}\n</script>')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(text, encoding='utf-8')
    print(f'Built {output} ({output.stat().st_size:,} bytes)')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist' / 'impossible-withdraw.html')
    build(parser.parse_args().output)
