"""ReadRx's icon: Cooky's glass orb, reshaped into a tilted capsule.

Same recipe as Cooky's logo: a conic color field (cyan, blue, violet,
pink) melted with soft color blobs, sphere-style shading with a top-left
sheen, a bright rim, a cyan-to-violet halo, fine grain, on white. The
capsule adds a faint seam where the two halves meet.

  python3 make_readrx_icon.py <out.png> [--rounded]
Full-bleed opaque by default (iOS and maskable web icons; the system
rounds the corners). --rounded adds Cooky's macOS squircle and shadow.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

S = 1024
out = sys.argv[1]
rounded = '--rounded' in sys.argv
y, x = np.mgrid[0:S, 0:S].astype(np.float32) + 0.5

def hexrgb(h):
    h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], np.float32) / 255

cx = cy = S / 2
scale = 0.8 if rounded else 1.0  # the squircle tile is 824/1024 of the canvas

# Background: white with the faintest cool gradient (Cooky's tile).
if rounded:
    half = 412
    u = np.abs(x - cx) / half; v = np.abs(y - cy) / half
    tile_mask = np.clip((1.0 - (u ** 5 + v ** 5)) * 60, 0, 1)
    t = np.clip((y - (cy - half)) / (2 * half), 0, 1)[..., None]
else:
    tile_mask = np.ones((S, S), np.float32)
    t = (y / S)[..., None]
tile = hexrgb('#ffffff') * (1 - t) + hexrgb('#eef4f8') * t

# ── Capsule: a segment of half-length A, radius R, tilted 40° ──
R = 150.0 * scale
A = 165.0 * scale
theta = np.radians(-40)
ux, uy = np.cos(theta), np.sin(theta)          # axis direction
px, py = x - cx, y - (cy - 4 * scale)
along = px * ux + py * uy                       # coordinate along the axis
across = -px * uy + py * ux                     # coordinate across it
proj = np.clip(along, -A, A)
d = np.sqrt((along - proj) ** 2 + across ** 2)  # distance to the axis segment
# Local "sphere" coordinates: offset from the nearest axis point.
lx = px - proj * ux
ly = py - proj * uy

# Color field along the capsule: conic around the center, melted with blobs.
ang = (np.degrees(np.arctan2(py, px)) - 210) % 360 / 360.0
stops = [hexrgb(c) for c in ('#22d3ee', '#3b82f6', '#a855f7', '#f472b6', '#22d3ee')]
seg = ang * (len(stops) - 1)
i0 = np.floor(seg).astype(int).clip(0, len(stops) - 2)
f = (seg - i0)[..., None]
S0 = np.stack(stops)
col = S0[i0] * (1 - f) + S0[i0 + 1] * f

def screen(a, b, w):
    w = w[..., None]
    return 1 - (1 - a) * (1 - b * w)

# Blobs placed in capsule space: cyan at the upper cap, pink at the lower.
for (pa, pc, c, sig) in [(-1.1, -0.2, '#22d3ee', 0.75), (-0.2, 0.5, '#3b82f6', 0.6),
                         (0.5, -0.4, '#a855f7', 0.65), (1.15, 0.2, '#f472b6', 0.7)]:
    bx = cx + (pa * A) * ux - (pc * R) * uy
    by = (cy - 4 * scale) + (pa * A) * uy + (pc * R) * ux
    g = np.exp(-((x - bx) ** 2 + (y - by) ** 2) / (2 * (sig * R) ** 2))
    col = screen(col, hexrgb(c), 0.8 * g)

col_img = Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8))
col = np.asarray(col_img.filter(ImageFilter.GaussianBlur(44 * scale)), np.float32) / 255
# The blobs screen toward white; push saturation back up to the orb's.
grey = col.mean(axis=2, keepdims=True)
col = np.clip(grey + (col - grey) * 1.45, 0, 1) * 0.97

# Shading, as on the orb but per cross-section: darker toward the
# bottom-right of the tube, lifted toward the top-left.
shade = ((lx * 0.6 + ly * 0.8) / R).clip(-1, 1)
col = col * (1 - 0.3 * np.clip(shade, 0, 1))[..., None]
# Sheen: a long soft highlight along the upper-left of the tube, brightest
# near the upper cap.
hl = np.exp(-((lx + 0.38 * R) ** 2 + (ly + 0.42 * R) ** 2) / (2 * (0.2 * R) ** 2))
hl *= np.clip(1.0 - (along + A) / (3.2 * A), 0.35, 1.0)
col = col + (1 - col) * (hl * 0.6)[..., None]
bounce = np.exp(-((lx - 0.2 * R) ** 2 + (ly - 0.9 * R) ** 2) / (2 * (0.32 * R) ** 2)) * 0.16
col = col + (1 - col) * bounce[..., None]
# Seam where the halves meet: a faint dark line with a light edge.
seam = np.exp(-(along ** 2) / (2 * (2.2 * scale) ** 2)) * (d < R)
col = col * (1 - 0.08 * seam)[..., None]
seam_hi = np.exp(-((along - 4 * scale) ** 2) / (2 * (2.0 * scale) ** 2)) * (d < R)
col = col + (1 - col) * (0.22 * seam_hi)[..., None]
# Rim light.
rim = np.exp(-((d - R + 3 * scale) ** 2) / (2 * (3.0 * scale) ** 2)) * 0.35
col = col + (1 - col) * rim[..., None]
cap_mask = np.clip(R - d + 0.5, 0, 1)

# Halo (cyan → violet down the icon).
halo = np.exp(-np.clip(d - R, 0, None) ** 2 / (2 * (50.0 * scale) ** 2)) * (d > R - 1)
vy = np.clip((y - (cy - A - R)) / (2 * (A + R)), 0, 1)[..., None]
halo_col = hexrgb('#22d3ee') * (1 - vy) + hexrgb('#8b5cf6') * vy
tile = tile * (1 - 0.34 * halo[..., None]) + halo_col * 0.34 * halo[..., None]
# Soft contact shadow under the capsule.
sh = np.exp(-np.clip(d - R * 0.92, 0, None) ** 2 / (2 * (26.0 * scale) ** 2))
sh_off = np.roll(np.roll(sh, int(22 * scale), axis=0), int(6 * scale), axis=1)
tile = tile * (1 - 0.1 * sh_off[..., None] * (1 - cap_mask[..., None]))

img = tile * (1 - cap_mask[..., None]) + col * cap_mask[..., None]
rng = np.random.default_rng(7)
img = np.clip(img + ((rng.random((S, S)).astype(np.float32) - 0.5) * 0.035)[..., None], 0, 1)

if not rounded:
    Image.fromarray((img * 255).astype(np.uint8)).convert('RGB').save(out)
else:
    icon = Image.fromarray((np.dstack([img, tile_mask]) * 255).astype(np.uint8))
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    s = Image.new('RGBA', (S, S), (10, 20, 30, 255)); s.putalpha(Image.fromarray((tile_mask * 255 * 0.32).astype(np.uint8)))
    s = s.filter(ImageFilter.GaussianBlur(18))
    shadow.paste(s, (0, 12), s)
    Image.alpha_composite(shadow, icon).save(out)
print('wrote', out)
