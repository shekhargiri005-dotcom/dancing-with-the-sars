"""
Time-Series Multi-Temporal SAR Generator for NISAR 12-Day Orbital Cycle
NASA Space Apps Challenge 2026
"""

import os
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from scipy.ndimage import gaussian_filter

ASSETS_DIR = "assets"
os.makedirs(ASSETS_DIR, exist_ok=True)

def generate_timeline_assets(width=1400, height=1050):
    # -------------------------------------------------------------
    # 1. LANGTANG VALLEY 5-ORBIT TIME-SERIES
    # -------------------------------------------------------------
    np.random.seed(101)
    y, x = np.mgrid[0:height, 0:width].astype(np.float32)

    # Base DEM
    dem = np.zeros((height, width), dtype=np.float32)
    octaves = [(450, 1.0), (220, 0.55), (110, 0.28), (55, 0.14), (25, 0.07), (12, 0.035)]
    for s, w in octaves:
        grid = np.random.randn(int(height / s) + 3, int(width / s) + 3)
        pil_grid = Image.fromarray(grid.astype(np.float32)).resize((width, height), Image.Resampling.BICUBIC)
        dem += np.array(pil_grid) * w
    dem = (dem - dem.min()) / (dem.max() - dem.min())

    canyon_x = 0.52 * width + (y - 0.5 * height) * 0.25 + 60 * np.sin(y * 0.008) + 25 * np.cos(y * 0.02)
    dist_canyon = np.abs(x - canyon_x)
    canyon_profile = np.exp(-(dist_canyon**2) / (2 * 110**2))
    dem = np.clip(dem - canyon_profile * 0.42, 0.0, 1.0)
    dem = gaussian_filter(dem, sigma=1.8)

    dy, dx = np.gradient(dem)
    look_x, look_y = -0.75, 0.25
    slope_facing = (dx * look_x + dy * look_y) * 26.0
    radar_base = np.clip(0.38 + slope_facing, 0.06, 0.94)
    shadow_mask = slope_facing < -0.32
    radar_base[shadow_mask] *= 0.35
    rock_texture = np.random.normal(0, 0.04, (height, width))
    radar_base = np.clip(radar_base + rock_texture, 0.05, 0.98)

    river_bed = (dist_canyon < 18) & (dem < 0.42)

    scarp_x, scarp_y = 0.34 * width, 0.28 * height
    dist_scarp = np.sqrt(((x - scarp_x) / 60)**2 + ((y - scarp_y) / 80)**2)
    scarp_mask = (dist_scarp < 1.0) & (dem > 0.48)

    chute_mask = np.zeros((height, width), dtype=bool)
    n_steps = 180
    for i in range(n_steps):
        t = i / float(n_steps)
        cx = scarp_x + t * (canyon_x[int(scarp_y + t * 240), 0] - scarp_x)
        cy = scarp_y + t * 240
        w_chute = 22 + t * 35 + 8 * np.sin(t * 12)
        d_chute = np.sqrt((x - cx)**2 + (y - cy)**2)
        chute_mask |= (d_chute < w_chute)

    dam_cy = 0.60 * height
    dam_cx = canyon_x[int(dam_cy), 0]
    fan_r = np.sqrt(((x - dam_cx) / 180)**2 + ((y - dam_cy) / 110)**2)
    debris_lobe = (fan_r < 1.0) & (dist_canyon < 140)
    roughness = gaussian_filter(np.random.randn(height, width), sigma=6.0)
    debris_lobe = debris_lobe & ((fan_r + roughness * 0.18) < 1.0)
    total_debris = scarp_mask | (chute_mask & (dem > 0.35)) | debris_lobe

    dam_upstream = (y >= 0.38 * height) & (y <= 0.58 * height)
    lake_full = dam_upstream & (dist_canyon < 55) & (dem < 0.38) & (~total_debris)
    lake_full = gaussian_filter(lake_full.astype(np.float32), sigma=2.0) > 0.35
    lake_full = lake_full & (~total_debris)

    # Partial lake after breach (Sep 09)
    lake_breached = lake_full & (dem < 0.33) & (dist_canyon < 35)

    def to_img(arr):
        u8 = np.clip(arr * 255.0, 0, 255).astype(np.uint8)
        im = Image.fromarray(u8, mode='L')
        return ImageEnhance.Contrast(im).enhance(1.2)

    # T1: 2026-07-23 (Stable baseline)
    spk1 = np.random.gamma(shape=16.0, scale=1.0/16.0, size=(height, width))
    t1 = radar_base * spk1
    t1[river_bed] *= 0.25
    to_img(t1).save(os.path.join(ASSETS_DIR, "langtang_t1.png"))

    # T2: 2026-08-04 (Creep onset, tension cracks)
    spk2 = np.random.gamma(shape=16.0, scale=1.0/16.0, size=(height, width))
    t2 = radar_base * spk2
    t2[river_bed] *= 0.25
    t2[scarp_mask] = np.clip(t2[scarp_mask] * 1.15, 0, 0.98) # Slight roughness increase at tension cracks
    to_img(t2).save(os.path.join(ASSETS_DIR, "langtang_t2.png"))

    # T3: 2026-08-16 (Pre-event immediate baseline - matches langtang_pre.png)
    spk3 = np.random.gamma(shape=16.0, scale=1.0/16.0, size=(height, width))
    t3 = radar_base * spk3
    t3[river_bed] *= 0.25
    t3[scarp_mask] = np.clip(t3[scarp_mask] * 1.25, 0, 0.98)
    to_img(t3).save(os.path.join(ASSETS_DIR, "langtang_t3.png"))

    # T4: 2026-08-28 (Post-collapse dam & full lake - matches langtang_post.png)
    spk4 = np.random.gamma(shape=16.0, scale=1.0/16.0, size=(height, width))
    t4 = radar_base.copy()
    debris_boost = 0.32 + 0.18 * np.random.gamma(4, 0.25, (height, width))
    t4[total_debris] = np.clip(t4[total_debris] * 1.55 + debris_boost[total_debris], 0.42, 0.98)
    t4[lake_full] = t4[lake_full] * 0.18
    t4 = np.clip(t4 * spk4, 0.03, 0.98)
    to_img(t4).save(os.path.join(ASSETS_DIR, "langtang_t4.png"))

    # T5: 2026-09-09 (Breached dam, reduced lake, scoured downstream corridor)
    spk5 = np.random.gamma(shape=16.0, scale=1.0/16.0, size=(height, width))
    t5 = radar_base.copy()
    t5[total_debris] = np.clip(t5[total_debris] * 1.45 + debris_boost[total_debris]*0.8, 0.40, 0.98)
    # Lake drained to 35% residual pond
    t5[lake_breached] = t5[lake_breached] * 0.18
    # Scoured mud on former lake shoreline (+3 dB)
    lake_mud = lake_full & (~lake_breached)
    t5[lake_mud] = np.clip(t5[lake_mud] * 1.35, 0.35, 0.85)
    t5 = np.clip(t5 * spk5, 0.03, 0.98)
    to_img(t5).save(os.path.join(ASSETS_DIR, "langtang_t5.png"))
    
    # T6: 2026-09-24 (Stabilized channel corridor, residual gravel moraine)
    spk6 = np.random.gamma(shape=16.0, scale=1.0/16.0, size=(height, width))
    t6 = radar_base.copy()
    t6[total_debris] = np.clip(t6[total_debris] * 1.35 + debris_boost[total_debris]*0.6, 0.35, 0.92)
    t6[lake_breached] = t6[lake_breached] * 0.22
    t6 = np.clip(t6 * spk6, 0.03, 0.98)
    to_img(t6).save(os.path.join(ASSETS_DIR, "langtang_t6.png"))
    print("Saved Langtang 6-cycle timeline assets (t1..t6).")

    # -------------------------------------------------------------
    # 2. SUICIDE BASIN 4-ORBIT TIME-SERIES (Geographically Aligned)
    # -------------------------------------------------------------
    np.random.seed(202)
    dem_sb = np.zeros((height, width), dtype=np.float32)
    for s, w in [(400, 1.0), (200, 0.5), (100, 0.25), (45, 0.12), (20, 0.05)]:
        grid = np.random.randn(int(height / s) + 3, int(width / s) + 3)
        dem_sb += np.array(Image.fromarray(grid.astype(np.float32)).resize((width, height), Image.Resampling.BICUBIC)) * w
    dem_sb = (dem_sb - dem_sb.min()) / (dem_sb.max() - dem_sb.min())

    # Carve Mendenhall Glacier
    glacier_cx = 0.49 * width + 25 * np.sin(y * 0.005)
    dist_glacier = np.abs(x - glacier_cx)
    glacier_trough = np.exp(-(dist_glacier**2) / (2 * 90**2))
    dem_sb = np.clip(dem_sb - glacier_trough * 0.40, 0.0, 1.0)

    # Suicide Basin pocket (East of glacier: x = 0.545 * width, y = 0.356 * height)
    basin_cx = 0.545 * width
    basin_cy = 0.356 * height
    dist_basin = np.sqrt(((x - basin_cx) / 80)**2 + ((y - basin_cy) / 65)**2)
    bowl = np.exp(-(dist_basin**2) / 1.5)
    dem_sb = np.clip(dem_sb - bowl * 0.35, 0.0, 1.0)

    # Mendenhall Lake terminus (x = 0.51 * width, y = 0.70 * height)
    lake_cx = 0.51 * width
    lake_cy = 0.70 * height
    dist_mendenhall = np.sqrt(((x - lake_cx) / 110)**2 + ((y - lake_cy) / 75)**2)
    dem_sb = np.clip(dem_sb - np.exp(-(dist_mendenhall**2) / 2.0) * 0.30, 0.0, 1.0)
    dem_sb = gaussian_filter(dem_sb, sigma=2.0)

    dy_s, dx_s = np.gradient(dem_sb)
    look_x, look_y = 0.75, -0.25
    slope_facing_s = (dx_s * look_x + dy_s * look_y) * 22.0
    radar_base_sb = np.clip(0.38 + slope_facing_s, 0.07, 0.95)

    suicide_lake = (dist_basin < 1.0) & (dem_sb < 0.42)
    suicide_lake = gaussian_filter(suicide_lake.astype(np.float32), sigma=2.0) > 0.35
    mendenhall_lake = (dist_mendenhall < 1.0) & (dem_sb < 0.36)

    # SB T1: 2026-07-10 (Lake filling, ~50% volume)
    spk_sb1 = np.random.gamma(shape=16.0, scale=1.0/16.0, size=(height, width))
    sb_t1 = radar_base_sb.copy()
    lake_half = suicide_lake & (dem_sb < 0.38)
    sb_t1[lake_half] *= 0.22
    sb_t1[mendenhall_lake] *= 0.25
    sb_t1 = np.clip(sb_t1 * spk_sb1, 0.03, 0.98)
    to_img(sb_t1).save(os.path.join(ASSETS_DIR, "suicide_basin_t1.png"))

    # SB T2: 2026-07-22 (Full lake peak, 31M m3, matches suicide_basin_pre.png)
    spk_sb2 = np.random.gamma(shape=16.0, scale=1.0/16.0, size=(height, width))
    sb_t2 = radar_base_sb.copy()
    sb_t2[suicide_lake] *= 0.20
    sb_t2[mendenhall_lake] *= 0.25
    sb_t2 = np.clip(sb_t2 * spk_sb2, 0.03, 0.98)
    to_img(sb_t2).save(os.path.join(ASSETS_DIR, "suicide_basin_t2.png"))

    # SB T3: 2026-08-15 (Immediately drained, exposed bouldery bed, flood surge in Mendenhall Lake)
    spk_sb3 = np.random.gamma(shape=16.0, scale=1.0/16.0, size=(height, width))
    sb_t3 = radar_base_sb.copy()
    drain_roughness = 0.35 + 0.22 * np.random.gamma(5, 0.2, (height, width))
    sb_t3[suicide_lake] = np.clip(sb_t3[suicide_lake] * 1.6 + drain_roughness[suicide_lake], 0.45, 0.97)
    sb_t3[mendenhall_lake] *= 0.18 # high turbid water with specular smooth surface
    sb_t3 = np.clip(sb_t3 * spk_sb3, 0.03, 0.98)
    to_img(sb_t3).save(os.path.join(ASSETS_DIR, "suicide_basin_t3.png"))

    # SB T4: 2026-08-27 (Post-drainage settling, braided channels on basin floor)
    spk_sb4 = np.random.gamma(shape=16.0, scale=1.0/16.0, size=(height, width))
    sb_t4 = radar_base_sb.copy()
    sb_t4[suicide_lake] = np.clip(sb_t4[suicide_lake] * 1.45 + drain_roughness[suicide_lake]*0.7, 0.40, 0.92)
    sb_t4[mendenhall_lake] *= 0.25
    sb_t4 = np.clip(sb_t4 * spk_sb4, 0.03, 0.98)
    to_img(sb_t4).save(os.path.join(ASSETS_DIR, "suicide_basin_t4.png"))
    
    # SB T5: 2026-09-04 (Post-drainage settling, braided gravel channels on basin floor)
    spk_sb5 = np.random.gamma(shape=16.0, scale=1.0/16.0, size=(height, width))
    sb_t5 = radar_base_sb.copy()
    sb_t5[suicide_lake] = np.clip(sb_t5[suicide_lake] * 1.35 + drain_roughness[suicide_lake]*0.5, 0.35, 0.88)
    sb_t5[mendenhall_lake] *= 0.25
    sb_t5 = np.clip(sb_t5 * spk_sb5, 0.03, 0.98)
    to_img(sb_t5).save(os.path.join(ASSETS_DIR, "suicide_basin_t5.png"))

    # SB T6: 2026-09-16 (Complete dry basin floor baseline, seasonal river drawdown)
    spk_sb6 = np.random.gamma(shape=16.0, scale=1.0/16.0, size=(height, width))
    sb_t6 = radar_base_sb.copy()
    sb_t6[suicide_lake] = np.clip(sb_t6[suicide_lake] * 1.25 + drain_roughness[suicide_lake]*0.35, 0.30, 0.82)
    sb_t6[mendenhall_lake] *= 0.25
    sb_t6 = np.clip(sb_t6 * spk_sb6, 0.03, 0.98)
    to_img(sb_t6).save(os.path.join(ASSETS_DIR, "suicide_basin_t6.png"))
    print("Saved Suicide Basin 6-cycle timeline assets (t1..t6).")

if __name__ == "__main__":
    generate_timeline_assets(1400, 1050)

