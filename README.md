# 🛰️ Dancing with the SARs (Hazard Radar Explorer)

> **"How Ice Becomes a Flood"** 🌊❄️  
> An interactive cyber-intelligence dashboard that translates complex **NASA-ISRO Synthetic Aperture Radar (NISAR)** microwave observations into actionable insights across catastrophic cryosphere hazards: subglacial lake outbursts (GLOFs) and massive rock-ice slope detachments.

[![Build Status](https://img.shields.io/badge/build-v69%20passed-00E5FF?style=flat-square&logo=github)](https://github.com/shekhargiri005-dotcom/dancing-with-the-sars)
[![Live Demo](https://img.shields.io/badge/Vercel-Live%20Demo-00FFFF?style=flat-square&logo=vercel)](https://dancing-with-the-sars-one.vercel.app/)
[![Radar Band](https://img.shields.io/badge/Sensor-NISAR%20L--Band%20(24.2%20cm)-0284c7?style=flat-square)](https://nisar.jpl.nasa.gov/)
[![NASA Space Apps](https://img.shields.io/badge/NASA%20Space%20Apps-2026-38bdf8?style=flat-square)](https://www.spaceappschallenge.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

---

## 📖 Table of Contents
1. [Overview & The Physics of L-Band SAR](#-overview--the-physics-of-l-band-sar)
2. [Interactive Application Modules](#-interactive-application-modules)
3. [Case Studies & Observation Schedules](#-case-studies--observation-schedules)
4. [Quickstart & Local Operation](#-quickstart--local-operation)
5. [Frontend Hosting with Vercel](#-frontend-hosting-with-vercel)
6. [Data Pipeline & Research Workflows](#-data-pipeline--research-workflows)
7. [UI Controls & Navigation](#-ui-controls--navigation)
8. [Repository Architecture](#-repository-architecture)
9. [Testing & Verification Suite](#-testing--verification-suite)
10. [Acknowledgments & Citations](#-acknowledgments--citations)

---

## 🔭 Overview & The Physics of L-Band SAR

Catastrophic cryosphere events—such as glacier detachment avalanches and glacial lake outburst floods (GLOFs)—frequently occur under dense monsoon cloud cover, severe mountain storms, or complete darkness. Conventional optical satellites (e.g., Sentinel-2, Landsat) cannot penetrate clouds or observe at night.

**NISAR's 24.2 cm L-band Synthetic Aperture Radar** solves this fundamental remote sensing barrier:
- **Cloud & Weather Penetration**: Microwave pulses with a wavelength of $\lambda = 24.2\text{ cm}$ propagate through tropospheric moisture, monsoon storm systems, volcanic plumes, and darkness with zero attenuation.
- **Specular Reflection Loss (Water Detection)**: Smooth open water bodies act as specular mirrors reflecting radar energy away from the sensor ($\sigma^0 \le -18\text{ dB}$, appearing black). When a glacial lake suddenly drains subglacially, the exposed rough boulder bed backscatters energy back to the sensor ($\sigma^0 \ge -8\text{ dB}$, a sudden $+6\text{ to }+10\text{ dB}$ jump).
- **Polarimetric Decomposition**:
  - **$HH$ (Horizontal Send, Horizontal Receive)**: Measures direct surface roughness and specular boundaries.
  - **$HV$ (Horizontal Send, Vertical Receive)**: Sensitive to depolarized volume scattering (fractured crevasses, turbulent debris flows, and vegetation canopy).
  - **Composite RGB ($HH / HV / \text{Ratio}$)**: Distinguishes stagnant ice, glacial silt, open meltwater, and shattered rock avalanche debris.
- **Repeat-Pass Differential Interferometry ($InSAR$)**: Compares phase shifts across 12-day orbital cycles to track millimeter-to-centimeter scale creep preceding catastrophic slope failures.

---

## 🖥️ Interactive Application Modules

The application is structured into five integrated cyber-intelligence modules accessible from the vertical HUD toolbar:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NISAR CYBER HUD PLATFORM                        │
├───────────────┬────────────────────────┬───────────────────────────────┤
│ [Launchpad]   │ [3D Dashboard]         │ [3D Hazard Globe]             │
│ Editorial     │ Holographic Isometric  │ Photorealistic CesiumJS       │
│ Dossier Intro │ Micro-Environments     │ Spaceborne Laser Beacons      │
├───────────────┴────────────────────────┴───────────────────────────────┤
│                                                                        │
│                   [GEOINT Place Explorer & Radar Lab]                  │
│       Dual-Observation Swipe • Polarimetry • 12-Day InSAR Pairs        │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│               [Forensic Story Dossiers & Retrospective Modal]          │
│       Two-Column Grid • Sticky Esri Mini-Maps • Historical GLOFs       │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. View 0: Editorial Mission Launchpad (`#landing-view`)
- Minimalist aerospace dark-editorial layout with active surveillance telemetry readouts.
- High-level executive briefing on spaceborne microwave monitoring.
- Direct historical story dossiers with route triggers into **Chamoli Disaster (Uttarakhand)** and **South Lhonak Moraine Burst (Sikkim)**.

### 2. View 1: 3D Command Center Dashboard (`#dashboard-view`)
- Isometric holographic cyber diorama powered by Three.js with slow-rotating planetary core and atmospheric halo.
- Micro-environment stations for **Langtang Canyon**, **Suicide Basin**, **Chamoli Scarp**, and **South Lhonak Lake**.
- Dynamic animated SVG laser circuit lines linking the planetary core to stations with hover pulse acceleration.
- Station filters: `[ ALL ICE NODES ]`, `[ LIVE NISAR ]`, and `[ HISTORICAL GLOFs ]`.
- Interactive node modals providing direct access to the Multi-Channel Radar Lab or Forensic Dossiers.

### 3. View 2: Interactive 3D Cesium Hazard Globe (`#globe-view`)
- Spaceborne orbital view of Earth rendered in CesiumJS with an astrophotography starfield background.
- High-resolution seamless polar cap fillers eliminating Web Mercator polar singularities.
- **Vertical Holographic Laser Beacons**: High-altitude vertical beams ($420\text{ km}$ orbital altitude) with ground contact flare discs and waypoint markers.
- **One-Click Fly-To Interaction**: Clicking any laser beacon smoothly zooms the camera toward the mountain site before seamlessly initializing the high-resolution Radar Lab.
- Live geodetic reticle HUD tracking mouse coordinates and orbital sensor altitude in real time.

### 4. View 3: Multi-Channel GEOINT Radar Lab (`#place-view`)
- **Dual-Observation Swipe Slider**: Split-screen comparison between pre-event satellite baselines and post-event L-band radar images.
- **Multi-Channel Polarimetry**:
  - `[CH 01] COMPOSITE RGB`: Combined $HH + HV + \text{Ratio}$ decomposition.
  - `[CH 02] HH CO-POL`: Surface roughness and specular water boundary tracking.
  - `[CH 03] HV CROSS-POL`: Volume scatter isolating debris and fractured seracs.
  - `[CH 04] InSAR CREEP`: Sub-centimeter ground deformation interferogram.
- **12-Day InSAR Radar Pairs Matrix**: Interactive matrix tabs allowing researchers to toggle between:
  - *No-Event Control Pair* (baseline seasonal movement)
  - *Event-Spanning Pair* (capturing the catastrophe)
  - *Post-Drainage Response Pair* (ice-dam flexure and moraine settling)
- **6-Cycle Time-Series Playback**: Temporal tracking slider across six consecutive 12-day NISAR repeat passes ($t_1 \to t_6$).
- **Physics Diagnostics & Probe HUD**: Real-time crosshair sampling surface roughness backscatter ($\text{dB}$), interferometric coherence ($\gamma$), and velocity vectors ($\text{cm/yr}$).

### 5. View 4: Editorial Story Dossiers (`#story-view`)
- Two-column editorial layout: Left column hosts the 3-part narrative breakdown (*What Happened*, *The Damage*, *How Radar Saw It*).
- **Sticky Geographic Mini-Map**: Right column features an interactive Leaflet mini-map powered by high-resolution Esri World Imagery (Satellite) and Esri Dark Canvas layers.
- Custom Neon Cyan (`#00FFFF`) pulsing marker with ripple wave effect.
- Map interaction lock/unlock control to prevent accidental scroll-jacking while reading.

### 6. Modal Overlays
- **Forensic Dossier Modal (`#dossier-modal`)**: Deep-dive retrospective investigation for historical disasters (**Chamoli / Rishiganga** and **South Lhonak**) with timeline milestones, human/infrastructure impacts, InSAR radar physics, historical data limitations, and scientific paper citations.
- **Three Flood Pathways Guide (`#guide-modal`)**: Glaciological reference guide categorizing the three primary cascade mechanisms:
  1. *Ice-Rock Avalanche Dam & Canyon Impoundment* (e.g., Chamoli & Langtang)
  2. *Subglacial Jökulhlaup Drainage* (e.g., Suicide Basin)
  3. *Moraine Dam Overtopping & Failure* (e.g., South Lhonak)

---

## 📊 Case Studies & Observation Schedules

All datasets and orbital geometries are synchronized with verified research parameters in [`data/cases.json`](data/cases.json):

| Case Study | Category | Coordinates | Orbit Track | Event Date | Spanning 12-Day Pair | Primary Sensor Signature |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Langtang Canyon** | Live NISAR | $28.25^\circ\text{N}, 85.50^\circ\text{E}$ | Track 98 (Asc.) | Aug 26, 2026 | **Aug 19 $\to$ Aug 31** | $+6.2\text{ dB}$ surge contrast, $11.4\text{ cm}$ InSAR creep, $3.42\text{ km}^2$ debris impoundment |
| **Suicide Basin** | Live NISAR | $58.46^\circ\text{N}, 134.57^\circ\text{W}$ | Track 144 (Desc.) | Aug 13, 2026 | **Aug 11 $\to$ Aug 23** | $31\text{M m}^3$ subglacial drainage, specular loss ($-18\text{ dB} \to +6.8\text{ dB}$ jump) |
| **Chamoli Scarp** | Historical | $30.38^\circ\text{N}, 79.73^\circ\text{E}$ | N/A (Pre-launch) | Feb 07, 2021 | N/A (Ground Truth) | $27\text{M m}^3$ rock-ice cliff detachment from $3,800\text{ m}$ elevation |
| **South Lhonak** | Historical | $27.91^\circ\text{N}, 88.20^\circ\text{E}$ | N/A (Pre-launch) | Oct 04, 2023 | N/A (Ground Truth) | $168\text{ ha}$ moraine breach in total nocturnal cloud cover |

### InSAR 12-Day Pass Matrix (6 Cycles)
```
LANGTANG (Track 98):
  Pass 1: Jul 14 ──┐ Control Pair
  Pass 2: Jul 26 ──┘ (No-event baseline)
  Pass 3: Aug 19 ──┐ Event Spanning Pair
  Pass 4: Aug 31 ──┘ (Event: Aug 26 avalanche)
  Pass 5: Sep 12 ──┐ Post-Response Pair
  Pass 6: Sep 24 ──┘ (Debris stabilization)

SUICIDE BASIN (Track 144):
  Pass 1: Jul 06 ──┐ Control Pair
  Pass 2: Jul 18 ──┘ (Meltwater inflow)
  Pass 3: Aug 11 ──┐ Event Spanning Pair
  Pass 4: Aug 23 ──┘ (Crest: Aug 13 drainage)
  Pass 5: Sep 04 ──┐ Post-Response Pair
  Pass 6: Sep 16 ──┘ (Ice dam settling)
```

---

## 🚀 Quickstart & Local Operation

### Prerequisites
- Python 3.9+ (any standard Python 3 installation)
- A modern WebGL-capable browser (Chrome, Edge, Firefox, Brave)
- *No complex Node.js build step or bundler required* (pure vanilla ES6+, HTML5, and CSS3).

### 1. Clone the Repository
```bash
git clone https://github.com/shekhargiri005-dotcom/dancing-with-the-sars.git
cd dancing-with-the-sars
```

### 2. Launch the Development Server
Use the included zero-cache HTTP server:
```bash
python server.py
```
*The server automatically attaches `Cache-Control: no-cache, no-store, must-revalidate` headers to ensure instant updates during local development.*

### 3. Open in Browser
Navigate to:
```
http://localhost:8080
```

---

## ⚡ Frontend Hosting with Vercel

The application is pre-configured for instant zero-configuration deployment on **Vercel** via [`vercel.json`](vercel.json).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fshekhargiri005-dotcom%2Fdancing-with-the-sars)

### Method 1: GitHub Web Dashboard (Recommended — Automatic CI/CD)
1. Go to **[vercel.com/new](https://vercel.com/new)** and sign in with your GitHub account.
2. Under **"Import Git Repository"**, select **`shekhargiri005-dotcom/dancing-with-the-sars`**.
3. In the project setup:
   - **Framework Preset**: `Other`
   - **Root Directory**: `./` (default)
   - **Build Command**: *(leave blank — purely static)*
   - **Output Directory**: *(leave blank)*
4. Click **Deploy**. Vercel will build and assign a global, high-speed HTTPS URL: **[dancing-with-the-sars-one.vercel.app](https://dancing-with-the-sars-one.vercel.app)**.
5. **Continuous Deployment**: Every future `git push origin main` will automatically build and deploy new preview and production releases.

### Method 2: Vercel CLI
Deploy directly from your terminal using the Vercel CLI:
```bash
# 1. Log in to Vercel
vercel login

# 2. Deploy directly to production
vercel --prod
```

### Pre-Configured Vercel Optimizations (`vercel.json`):
- **Edge Telemetry Endpoint**: Serverless API `/api/log` streaming client telemetry and exceptions directly to Vercel runtime logs.
- **High-Performance Caching**: Satellite and radar asset layers in `/assets/*` are configured with `public, max-age=31536000, immutable` for edge CDN caching.
- **Instant Data Invalidation**: `data/cases.json` and application assets use `must-revalidate` to ensure immediate propagation of scenario and telemetry updates.
- **Security & Frame Hardening**: Pre-configured HTTP response headers (`nosniff`, `DENY` framing, `strict-origin-when-cross-origin`).
- **Clean Rewrites**: SPA routing cleanly resolves to `/index.html` without breaking direct deep links.

---

## 🔬 Data Pipeline & Research Workflows

For researchers wishing to pull operational NISAR Level-1 (L1) and Level-2 (L2) granules directly from NASA's Alaska Satellite Facility (ASF) DAAC:

### Executable Python CLI Pipeline
[`pipeline_stage1_2.py`](pipeline_stage1_2.py) provides a complete command-line interface for downloading, calibrating, and processing radar data:

```bash
# Display help and available options
python pipeline_stage1_2.py --help

# Query and process Langtang Avalanche (Track 98)
python pipeline_stage1_2.py --target langtang --product GCOV

# Query and process Suicide Basin Drainage (Track 144)
python pipeline_stage1_2.py --target suicide_basin --product GUNW
```

### Interactive Jupyter Notebook
[`stage1_2.ipynb`](stage1_2.ipynb) contains a 27-cell forensic workflow:
1. **NASA Earthdata Authentication**: Token authentication with ASF DAAC.
2. **Granule Spatial Discovery**: Bounding box queries filtering for Track 98 and Track 144.
3. **Radiometric Terrain Correction (RTC)**: Converting raw digital numbers ($DN$) to normalized radar cross section $\sigma^0$ ($\text{dB}$).
4. **Dual-Pol Ratio Extraction**: Calculating $HH/HV$ cross-polarization ratios.
5. **Phase Interferogram Generation**: Complex conjugate multiplication for centimeter-scale line-of-sight ($LOS$) displacement.
6. **Water Loss Masking**: Threshold-based specular loss segmentation.

---

## 🎮 UI Controls & Navigation

- **Mobile Navigation Drawer & Universal Back-Bar**:
  - **Universal Go-Back Navigation**: Dedicated multi-destination navigation bar in Radar Lab (`← LAUNCHPAD`, `🧊 3D DASHBOARD`, `🌐 3D GLOBE`, `❖ MENU`) ensuring effortless switching and direct returns on mobile devices.
  - **Full Mobile Mission Drawer (`#mobile-nav-drawer`)**: Glassmorphic bottom slide-up drawer granting 100% full mobile access to all 4 core modules, all 4 hazard scenarios (Langtang, Suicide Basin, Chamoli, South Lhonak), Mission Tour, and Glaciology Guide.
  - **Touch-Optimized Bottom HUD Pill**: Restyles the vertical HUD tab into a floating bottom pill with direct tap handling on touchscreens (`max-width: 768px`).
  - **Streamlined Mobile Telemetry**: Repositions the physics probe HUD at the bottom to prevent viewport obstruction.
- **Left Vertical Cyber HUD Toolbar (Desktop)**:
  - **Default Closed & Smart Hover**: Starts minimized to keep views unobstructed; hover cursor over the left edge tab (`❖ HUD · EXPAND ▸`) to automatically slide out the HUD; auto-collapses on mouse leave.
  - `Launchpad`: Jump to the editorial dossier intro.
  - `3D Dashboard`: Enter the isometric command room.
  - `3D Globe`: Launch the Cesium spaceborne view.
  - `Mission Scenarios`: Instant jump to Langtang, Suicide Basin, Chamoli, or South Lhonak.
  - `Mission Tour`: Automated camera tour across cryosphere stations.
  - `Keyboard Shortcuts`: Press `H` to toggle HUD minimization, `Esc` to close any open modal or tour, and `1`–`5` for instant view switching.
- **3D Globe Navigation**:
  - **Left Click + Drag**: Rotate Earth.
  - **Right Click + Drag / Scroll Wheel**: Zoom in/out.
  - **Click Laser Beacon**: Cinematic camera zoom into the hazard site and automatic opening of the Radar Lab.
- **Radar Lab Controls**:
  - **Divider Slider**: Click/drag horizontal swipe handle to compare pre- and post-event imagery.
  - **Signal Pills**: Toggle polarimetric decomposition channels.
  - **12-Day Pair Buttons**: Switch between control, event, and response radar pairs.
  - **Time-Series Bar**: Click any observation cycle ($t_1 \to t_6$) to animate glacier changes over time.

---

## 📁 Repository Architecture

```
dancing-with-the-sars/
├── index.html                   # Core single-page application & HUD layouts
├── app.js                       # Frontend architecture (Cesium, Three.js, Leaflet)
├── style.css                    # Cyberpunk glassmorphism design system
├── server.py                    # Local zero-cache HTTP development server
├── stage1_2.ipynb               # 27-cell NASA Earthdata research notebook
├── pipeline_stage1_2.py         # Standalone CLI SAR processing pipeline
├── generate_realistic_sar.py    # Synthetic physical radar channel generator
├── generate_timeline_assets.py  # 6-pass time-series asset generator
├── favicon.ico                  # Application icon
├── vercel.json                  # Vercel CDN caching, rewrites & headers
├── package.json                 # Project metadata & scripts
├── .gitignore                   # Excludes database, scratch, and credentials
├── README.md                    # System architecture and documentation
├── api/
│   └── log.js                   # Serverless client-side telemetry logger
├── data/
│   └── cases.json               # Primary schema for hazards, tracks, & dates
└── assets/
    ├── earth_real.jpg           # NASA Blue Marble base texture
    ├── earth_vector_hologram.png# Dashboard 3D wireframe core globe texture
    ├── globe_starfield_bg.png   # Space background for 3D globe view
    ├── north_pole_cap.png       # Polar cap singularity filler (North)
    ├── south_pole_cap.png       # Polar cap singularity filler (South)
    ├── langtang_*.png           # Radar products & t1..t6 cycles (Langtang)
    └── suicide_basin_*.png      # Radar products & t1..t6 cycles (Suicide Basin)
```

---

## 🧪 Testing & Verification Suite

The repository includes a self-contained test suite in `scratch/` (maintained locally to safeguard development integrity):

```bash
# Run complete system integrity check (build verification)
node scratch/verify_all.js

# Verify all 144 DOM element IDs mapped in JavaScript exist in HTML
node scratch/verify_ids.js

# Verify all 18 core application functions are defined and error-free
node scratch/check_full_app_functions.js
```

---

## 🤝 Acknowledgments & Citations

- **NASA Jet Propulsion Laboratory (JPL) & Indian Space Research Organisation (ISRO)** for the NISAR science mission definitions and L-band radar documentation.
- **Alaska Satellite Facility (ASF) DAAC** for SAR data distribution and the `asf_search` API.
- **NASA Space Apps Challenge 2026** — *Dancing with the SARs: How Ice Becomes a Flood*.
- Built with [CesiumJS](https://cesium.com/), [Three.js](https://threejs.org/), [Leaflet](https://leafletjs.com/), and [JetBrains Mono](https://www.jetbrains.com/lp/mono/).
