"""
High-Fidelity Photorealistic SAR Generator for NISAR Radar Explorer
NASA Space Apps Challenge 2026
"""

import os
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from scipy.ndimage import gaussian_filter, distance_transform_edt

ASSETS_DIR = "assets"
os.makedirs(ASSETS_DIR, exist_ok=True)

def generate_langtang_radar(width=1400, height=1050):
    np.random.seed(101)
    y, x = np.mgrid[0:height, 0:width].astype(np.float32)
    
    # 1. Multi-scale Fractal Himalayan Topography
    print("Generating Langtang terrain elevation model...")
    dem = np.zeros((height, width), dtype=np.float32)
    octaves = [
        (450, 1.0),
        (220, 0.55),
        (110, 0.28),
        (55, 0.14),
        (25, 0.07),
        (12, 0.035)
    ]
    for s, w in octaves:
        grid = np.random.randn(int(height / s) + 3, int(width / s) + 3)
        pil_grid = Image.fromarray(grid.astype(np.float32)).resize((width, height), Image.Resampling.BICUBIC)
        dem += np.array(pil_grid) * w

    # Normalize DEM to realistic elevation scale (0 to 1)
    dem = (dem - dem.min()) / (dem.max() - dem.min())
    
    # Carve main Langtang valley canyon (running diagonally from NW to SE)
    canyon_x = 0.52 * width + (y - 0.5 * height) * 0.25 + 60 * np.sin(y * 0.008) + 25 * np.cos(y * 0.02)
    dist_canyon = np.abs(x - canyon_x)
    canyon_profile = np.exp(-(dist_canyon**2) / (2 * 110**2))
    dem = np.clip(dem - canyon_profile * 0.42, 0.0, 1.0)
    
    # Re-smooth DEM slightly to mimic natural erosion slopes
    dem = gaussian_filter(dem, sigma=1.8)
    
    # 2. Physics-Based Radar Backscatter Simulation
    # NISAR L-band descending pass: Radar illuminates from East-South-East (look vector)
    print("Computing SAR illumination and foreshortening...")
    dy, dx = np.gradient(dem)
    
    # Incidence angle shading: look vector components
    look_x = -0.75
    look_y = 0.25
    slope_facing = (dx * look_x + dy * look_y) * 26.0
    
    # Backscatter base (normalized 0.1 to 0.85)
    radar_base = np.clip(0.38 + slope_facing, 0.06, 0.94)
    
    # Radar shadow on slopes facing away
    shadow_mask = slope_facing < -0.32
    radar_base[shadow_mask] *= 0.35
    
    # Add high-frequency rock roughness texture
    rock_texture = np.random.normal(0, 0.04, (height, width))
    radar_base = np.clip(radar_base + rock_texture, 0.05, 0.98)
    
    # Pre-event: Natural narrow river course along valley bottom
    river_bed = (dist_canyon < 18) & (dem < 0.42)
    
    # SAR Multi-look Speckle (Gamma distribution, 4-look equivalent)
    speckle_pre = np.random.gamma(shape=16.0, scale=1.0/16.0, size=(height, width))
    pre_sar = radar_base * speckle_pre
    # Calm river water is specular (reflects away from radar -> dark, -18 dB)
    pre_sar[river_bed] = pre_sar[river_bed] * 0.25
    pre_sar = np.clip(pre_sar, 0.03, 0.98)
    
    # 3. Avalanche Event Geomorphology (Aug 26, 2026)
    # Detachment scarp high on northwest wall (near x=476, y=288)
    scarp_x, scarp_y = 0.34 * width, 0.28 * height
    dist_scarp = np.sqrt(((x - scarp_x) / 60)**2 + ((y - scarp_y) / 80)**2)
    scarp_mask = (dist_scarp < 1.0) & (dem > 0.48)
    
    # Avalanche track/chute cascading down the mountain couloir to the canyon floor
    # We follow the terrain gradient from scarp down into the valley
    chute_mask = np.zeros((height, width), dtype=bool)
    n_steps = 180
    for i in range(n_steps):
        t = i / float(n_steps)
        cx = scarp_x + t * (canyon_x[int(scarp_y + t * 240), 0] - scarp_x)
        cy = scarp_y + t * 240
        w_chute = 22 + t * 35 + 8 * np.sin(t * 12)
        d_chute = np.sqrt((x - cx)**2 + (y - cy)**2)
        chute_mask |= (d_chute < w_chute)
    
    # Valley debris dam: Lobed, dendritic debris fan choking the canyon
    dam_cy = 0.60 * height
    dam_cx = canyon_x[int(dam_cy), 0]
    # Elliptical spread along river corridor with lobed fingers
    fan_r = np.sqrt(((x - dam_cx) / 180)**2 + ((y - dam_cy) / 110)**2)
    debris_lobe = (fan_r < 1.0) & (dist_canyon < 140)
    # Add natural lobed fingering using fractal roughness
    roughness = gaussian_filter(np.random.randn(height, width), sigma=6.0)
    debris_lobe = debris_lobe & ((fan_r + roughness * 0.18) < 1.0)
    
    total_debris = scarp_mask | (chute_mask & (dem > 0.35)) | debris_lobe
    
    # Impounded river lake: Water accumulates behind the debris dam upstream!
    # Upstream along canyon is y from ~360 to ~570
    dam_upstream = (y >= 0.38 * height) & (y <= 0.58 * height)
    # Natural flooding based on DEM elevation contour in canyon floor
    lake_mask = dam_upstream & (dist_canyon < 55) & (dem < 0.38) & (~total_debris)
    # Smooth lake shoreline
    lake_mask = gaussian_filter(lake_mask.astype(np.float32), sigma=2.0) > 0.35
    lake_mask = lake_mask & (~total_debris)
    
    # 4. Construct Post-Event SAR Image
    speckle_post = np.random.gamma(shape=16.0, scale=1.0/16.0, size=(height, width))
    post_sar = radar_base.copy()
    
    # Debris has high roughness (angular fragmented rock boulders & pulverized ice -> +5 dB to +7 dB)
    debris_boost = 0.32 + 0.18 * np.random.gamma(4, 0.25, (height, width))
    post_sar[total_debris] = np.clip(post_sar[total_debris] * 1.55 + debris_boost[total_debris], 0.42, 0.98)
    
    # Impounded water is a specular mirror -> extremely low backscatter (-18 dB)
    post_sar[lake_mask] = post_sar[lake_mask] * 0.18
    
    # Apply post speckle
    post_sar = np.clip(post_sar * speckle_post, 0.03, 0.98)
    
    # 5. Generate Products
    # A. Grayscale GCOV
    def to_img(arr):
        u8 = np.clip(arr * 255.0, 0, 255).astype(np.uint8)
        im = Image.fromarray(u8, mode='L')
        # Subtle contrast stretch for crisp professional display
        im = ImageEnhance.Contrast(im).enhance(1.22)
        return im
        
    # Distinct Polarizations: HH (Dielectric/Specular) and HV (Cross-pol Roughness)
    # HH: Water is specular black (-20 dB), slopes have surface bounce, debris is bright
    hh_sar = post_sar.copy()
    
    # HV: Water has zero cross-pol (-30 dB), slopes are muted, rough chaotic debris lights up intensely
    hv_sar = (post_sar * 0.45)
    hv_debris = total_debris & (np.random.rand(height, width) > 0.08)
    hv_sar[hv_debris] = np.clip(post_sar[hv_debris] * 1.35 + 0.15 * np.random.gamma(4, 0.2, np.sum(hv_debris)), 0.35, 0.98)
    hv_sar[lake_mask] = np.clip(hv_sar[lake_mask] * 0.08, 0.01, 0.04) # Near absolute zero in cross-pol
    hv_sar = np.clip(hv_sar, 0.02, 0.98)

    pre_img = to_img(pre_sar)
    post_img = to_img(post_sar)
    hh_img = to_img(hh_sar)
    hv_img = to_img(hv_sar)
    
    # B. False-Color RGB Composite
    # Red = Post, Green = Pre, Blue = Post (Standard dual-temporal SAR composite)
    # Debris appears bright Red-Orange, Lake appears Cyan-Blue, unchanged background is neutral
    comp_r = np.clip(post_sar * 1.25, 0, 1)
    comp_g = np.clip(pre_sar * 1.15, 0, 1)
    comp_b = np.clip((post_sar * 0.7 + pre_sar * 0.3), 0, 1)
    # Boost colors specifically on change areas
    comp_r[total_debris] = np.clip(comp_r[total_debris] * 1.35, 0, 1)
    comp_b[lake_mask] = np.clip(comp_g[lake_mask] * 1.4 + 0.2, 0, 1)
    comp_g[lake_mask] = np.clip(comp_g[lake_mask] * 1.2 + 0.1, 0, 1)
    comp_rgb = np.stack([
        np.clip(comp_r * 255, 0, 255).astype(np.uint8),
        np.clip(comp_g * 255, 0, 255).astype(np.uint8),
        np.clip(comp_b * 255, 0, 255).astype(np.uint8)
    ], axis=-1)
    comp_img = Image.fromarray(comp_rgb, mode='RGB')
    comp_img = ImageEnhance.Color(comp_img).enhance(1.3)
    comp_img = ImageEnhance.Contrast(comp_img).enhance(1.15)
    
    # C. RGBA Activity Heatmap (Smooth glowing alpha overlay)
    heat_rgba = np.zeros((height, width, 4), dtype=np.uint8)
    # Debris -> Vivid Glowing Crimson/Orange
    debris_float = gaussian_filter(total_debris.astype(np.float32), sigma=3.0)
    debris_glow = debris_float > 0.12
    heat_rgba[debris_glow, 0] = 255
    heat_rgba[debris_glow, 1] = (60 + 120 * (1 - debris_float[debris_glow])).astype(np.uint8)
    heat_rgba[debris_glow, 2] = 20
    heat_rgba[debris_glow, 3] = np.clip(debris_float[debris_glow] * 240, 0, 230).astype(np.uint8)
    
    # Lake -> Vivid Glowing Electric Blue/Cyan
    lake_float = gaussian_filter(lake_mask.astype(np.float32), sigma=2.5)
    lake_glow = lake_float > 0.15
    heat_rgba[lake_glow, 0] = 12
    heat_rgba[lake_glow, 1] = (165 + 60 * lake_float[lake_glow]).astype(np.uint8)
    heat_rgba[lake_glow, 2] = 255
    heat_rgba[lake_glow, 3] = np.clip(lake_float[lake_glow] * 240, 0, 235).astype(np.uint8)
    heat_img = Image.fromarray(heat_rgba, mode='RGBA')
    
    # D. InSAR Pre-failure Creep / Displacement (GUNW)
    disp_rgba = np.zeros((height, width, 4), dtype=np.uint8)
    creep_dist = np.sqrt(((x - scarp_x) / 90)**2 + ((y - scarp_y) / 110)**2)
    creep_field = np.exp(-(creep_dist**2) / 1.8)
    creep_active = creep_field > 0.10
    
    # Plasma / Turbo style interferometric fringe
    disp_rgba[creep_active, 0] = (255 * np.clip(creep_field[creep_active] * 1.3, 0, 1)).astype(np.uint8)
    disp_rgba[creep_active, 1] = (70 * (1 - creep_field[creep_active])).astype(np.uint8)
    disp_rgba[creep_active, 2] = (220 * creep_field[creep_active]).astype(np.uint8)
    disp_rgba[creep_active, 3] = np.clip(creep_field[creep_active] * 240, 50, 225).astype(np.uint8)
    disp_img = Image.fromarray(disp_rgba, mode='RGBA').filter(ImageFilter.GaussianBlur(radius=2))
    
    # Save Langtang Assets
    pre_img.save(os.path.join(ASSETS_DIR, "langtang_pre.png"))
    post_img.save(os.path.join(ASSETS_DIR, "langtang_post.png"))
    hh_img.save(os.path.join(ASSETS_DIR, "langtang_hh.png"))
    hv_img.save(os.path.join(ASSETS_DIR, "langtang_hv.png"))
    comp_img.save(os.path.join(ASSETS_DIR, "langtang_composite.png"))
    heat_img.save(os.path.join(ASSETS_DIR, "langtang_heatmap.png"))
    disp_img.save(os.path.join(ASSETS_DIR, "langtang_displacement.png"))
    print("Saved Langtang high-definition SAR products.")


def generate_suicide_basin_radar(width=1400, height=1050):
    np.random.seed(202)
    y, x = np.mgrid[0:height, 0:width].astype(np.float32)
    
    print("Generating Suicide Basin elevation and ice field model (geographically aligned)...")
    # Multi-scale Alaskan glacial terrain
    dem = np.zeros((height, width), dtype=np.float32)
    for s, w in [(400, 1.0), (200, 0.5), (100, 0.25), (45, 0.12), (20, 0.05)]:
        grid = np.random.randn(int(height / s) + 3, int(width / s) + 3)
        dem += np.array(Image.fromarray(grid.astype(np.float32)).resize((width, height), Image.Resampling.BICUBIC)) * w
        
    dem = (dem - dem.min()) / (dem.max() - dem.min())
    
    # Carve main Mendenhall Glacier valley (running North to South around x = 0.49 * width)
    glacier_center_x = 0.49 * width + 25 * np.sin(y * 0.005)
    dist_glacier = np.abs(x - glacier_center_x)
    glacier_trough = np.exp(-(dist_glacier**2) / (2 * 90**2))
    dem = np.clip(dem - glacier_trough * 0.40, 0.0, 1.0)
    
    # Suicide Basin pocket (on EAST side of glacier, y = 0.356 * height, x = 0.545 * width)
    basin_cx = 0.545 * width
    basin_cy = 0.356 * height
    dist_basin = np.sqrt(((x - basin_cx) / 80)**2 + ((y - basin_cy) / 65)**2)
    bowl = np.exp(-(dist_basin**2) / 1.5)
    dem = np.clip(dem - bowl * 0.35, 0.0, 1.0)
    
    # Mendenhall Lake terminus at bottom (y = 0.70 * height, x = 0.51 * width)
    lake_cx = 0.51 * width
    lake_cy = 0.70 * height
    dist_mendenhall_lake = np.sqrt(((x - lake_cx) / 110)**2 + ((y - lake_cy) / 75)**2)
    dem = np.clip(dem - np.exp(-(dist_mendenhall_lake**2) / 2.0) * 0.30, 0.0, 1.0)
    dem = gaussian_filter(dem, sigma=2.0)
    
    # SAR Illumination (Ascending track, West-to-East look)
    dy, dx = np.gradient(dem)
    look_x, look_y = 0.75, -0.25
    slope_facing = (dx * look_x + dy * look_y) * 22.0
    radar_base = np.clip(0.38 + slope_facing, 0.07, 0.95)
    
    # Basin contour
    suicide_lake = (dist_basin < 1.0) & (dem < 0.42)
    suicide_lake = gaussian_filter(suicide_lake.astype(np.float32), sigma=2.0) > 0.35
    
    # Mendenhall Lake water surface
    mendenhall_lake = (dist_mendenhall_lake < 1.0) & (dem < 0.36)
    
    # Pre-event: Suicide Basin is full of water (-18 dB specular) with scattered calved icebergs
    speckle_pre = np.random.gamma(shape=16.0, scale=1.0/16.0, size=(height, width))
    pre_sar = radar_base * speckle_pre
    pre_sar[suicide_lake] *= 0.20
    pre_sar[mendenhall_lake] *= 0.22
    # Floating icebergs in basin
    icebergs = suicide_lake & (np.random.rand(height, width) > 0.985)
    pre_sar[icebergs] = np.clip(pre_sar[icebergs] * 3.5, 0.6, 0.95)
    pre_sar = np.clip(pre_sar, 0.03, 0.98)
    
    # Post-event: Suicide Basin completely drained!
    # Basin floor exposed: rugged fractured bedrock, cracked moraine silt, stranded ice blocks (+6.8 dB)
    speckle_post = np.random.gamma(shape=16.0, scale=1.0/16.0, size=(height, width))
    post_sar = radar_base.copy()
    drain_roughness = 0.36 + 0.20 * np.random.gamma(5, 0.2, (height, width))
    post_sar[suicide_lake] = np.clip(post_sar[suicide_lake] * 1.55 + drain_roughness[suicide_lake], 0.45, 0.97)
    # Mendenhall Lake shows surge boundary
    post_sar[mendenhall_lake] *= 0.20
    post_sar = np.clip(post_sar * speckle_post, 0.03, 0.98)
    
    # Products
    def to_img(arr):
        u8 = np.clip(arr * 255.0, 0, 255).astype(np.uint8)
        im = Image.fromarray(u8, mode='L')
        return ImageEnhance.Contrast(im).enhance(1.2)
        
    hh_sar = post_sar.copy()
    hv_sar = (post_sar * 0.40)
    hv_sar[suicide_lake] = np.clip(post_sar[suicide_lake] * 1.4 + 0.18 * np.random.gamma(4, 0.2, np.sum(suicide_lake)), 0.38, 0.96)
    hv_sar = np.clip(hv_sar, 0.02, 0.98)

    pre_img = to_img(pre_sar)
    post_img = to_img(post_sar)
    hh_img = to_img(hh_sar)
    hv_img = to_img(hv_sar)
    
    # Composite:
    comp_r = np.clip(post_sar * 1.3, 0, 1)
    comp_g = np.clip(pre_sar * 1.1, 0, 1)
    comp_b = np.clip(post_sar * 0.7, 0, 1)
    comp_r[suicide_lake] = np.clip(comp_r[suicide_lake] * 1.45, 0, 1)
    comp_g[suicide_lake] = np.clip(comp_g[suicide_lake] * 1.25, 0, 1)
    comp_rgb = np.stack([
        (comp_r * 255).astype(np.uint8),
        (comp_g * 255).astype(np.uint8),
        (comp_b * 255).astype(np.uint8)
    ], axis=-1)
    comp_img = ImageEnhance.Color(Image.fromarray(comp_rgb, mode='RGB')).enhance(1.3)
    
    # Heatmap: Amber/Orange for exposed lakebed
    heat_rgba = np.zeros((height, width, 4), dtype=np.uint8)
    lake_float = gaussian_filter(suicide_lake.astype(np.float32), sigma=3.0)
    lake_active = lake_float > 0.12
    heat_rgba[lake_active, 0] = 255
    heat_rgba[lake_active, 1] = (145 + 50 * (1 - lake_float[lake_active])).astype(np.uint8)
    heat_rgba[lake_active, 2] = 10
    heat_rgba[lake_active, 3] = np.clip(lake_float[lake_active] * 240, 0, 230).astype(np.uint8)
    heat_img = Image.fromarray(heat_rgba, mode='RGBA')
    
    # InSAR Creep: Mendenhall ice dam deformation (junction at x = 0.49 * width, y = 0.344 * height)
    disp_rgba = np.zeros((height, width, 4), dtype=np.uint8)
    dam_x, dam_y = 0.49 * width, 0.344 * height
    dam_dist = np.sqrt(((x - dam_x) / 70)**2 + ((y - dam_y) / 60)**2)
    dam_creep = np.exp(-(dam_dist**2) / 1.5)
    dam_active = dam_creep > 0.12
    disp_rgba[dam_active, 0] = 250
    disp_rgba[dam_active, 1] = (80 * (1 - dam_creep[dam_active])).astype(np.uint8)
    disp_rgba[dam_active, 2] = 160
    disp_rgba[dam_active, 3] = np.clip(dam_creep[dam_active] * 235, 40, 220).astype(np.uint8)
    disp_img = Image.fromarray(disp_rgba, mode='RGBA').filter(ImageFilter.GaussianBlur(radius=2))
    
    pre_img.save(os.path.join(ASSETS_DIR, "suicide_basin_pre.png"))
    post_img.save(os.path.join(ASSETS_DIR, "suicide_basin_post.png"))
    hh_img.save(os.path.join(ASSETS_DIR, "suicide_basin_hh.png"))
    hv_img.save(os.path.join(ASSETS_DIR, "suicide_basin_hv.png"))
    comp_img.save(os.path.join(ASSETS_DIR, "suicide_basin_composite.png"))
    heat_img.save(os.path.join(ASSETS_DIR, "suicide_basin_heatmap.png"))
    disp_img.save(os.path.join(ASSETS_DIR, "suicide_basin_displacement.png"))
    print("Saved geographically aligned Suicide Basin SAR products.")

if __name__ == "__main__":
    generate_langtang_radar(1400, 1050)
    generate_suicide_basin_radar(1400, 1050)
    print("All photorealistic SAR products generated successfully.")

