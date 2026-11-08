// Dancing with the SARs: Main Application Controller
// NASA Space Apps Challenge 2026

let appData = null;
let currentCase = null;
let currentSignal = 'diff'; // 'diff' | 'composite' | 'heatmap' | 'creep'
let currentBasemap = 'satellite'; // 'satellite' | 'topo'
let showFeaturePins = true;

let worldMap = null;
let placeMap = null;
let storyMiniMap = null;

let preOverlay = null;
let postOverlay = null;
let compOverlay = null;
let heatOverlay = null;
let creepOverlay = null;
let hhOverlay = null;
let hvOverlay = null;
let timelineOverlay = null;
let currentTimelineIndex = 0;
let isTimelinePlaying = false;
let timelineInterval = null;
let swathBoundaryRect = null;
let featureMarkerGroup = null;

let currentTileLayerWorld = null;
let currentTileLayerPlace = null;

// Free, No-API-Key, No-Watermark Tile URLs
const ESRI_SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTRIBUTION = 'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community';

const OSM_TOPO_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ESRI_DARK_GRAY_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const ESRI_DARK_GRAY_ATTR = 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ';

// ==========================================================================
// Vercel & Client-Side Telemetry Logger
// Forwards client-side errors, uncaught exceptions, and user telemetry
// directly to /api/log so they appear in real-time in the Vercel Dashboard Logs.
// ==========================================================================
let isLoggingInternal = false;

function sendClientLog(level, event, message, details = {}) {
  if (isLoggingInternal) return;
  try {
    const payload = JSON.stringify({
      level: level || 'info',
      event: event || 'UI_EVENT',
      message: String(message || ''),
      details: details || {},
      url: window.location.pathname + window.location.search,
      userAgent: (typeof navigator !== 'undefined') ? navigator.userAgent : 'Unknown',
      timestamp: new Date().toISOString()
    });

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon('/api/log', blob);
      if (sent) return;
    }

    if (typeof fetch === 'function') {
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(() => {});
    }
  } catch (err) {
    // Non-blocking
  }
}

// 1. Capture Uncaught JavaScript Runtime Errors
window.addEventListener('error', event => {
  sendClientLog('error', 'UNCAUGHT_EXCEPTION', event.message || 'Script error', {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error ? event.error.stack : null
  });
});

// 2. Capture Unhandled Promise Rejections (e.g. Asset 404s, Network timeouts)
window.addEventListener('unhandledrejection', event => {
  const reason = event.reason;
  sendClientLog('error', 'UNHANDLED_REJECTION', reason ? (reason.message || String(reason)) : 'Promise rejected', {
    stack: (reason && reason.stack) ? reason.stack : null
  });
});

// 3. Intercept console.error & console.warn for external library warnings
try {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  console.error = function(...args) {
    originalConsoleError.apply(console, args);
    isLoggingInternal = true;
    try {
      sendClientLog('error', 'CONSOLE_ERROR', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    } catch (e) {}
    isLoggingInternal = false;
  };

  console.warn = function(...args) {
    originalConsoleWarn.apply(console, args);
    isLoggingInternal = true;
    try {
      sendClientLog('warn', 'CONSOLE_WARN', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    } catch (e) {}
    isLoggingInternal = false;
  };
} catch (e) {}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('data/cases.json?v=20261107_v53');
    appData = await res.json();
    sendClientLog('info', 'APP_INIT', 'NISAR Frontend initialized (v53)', {
      build: '20261107_v53',
      viewport: `${window.innerWidth}x${window.innerHeight}`
    });
    
    // Set initial view to Landing View
    switchView('landing');
    setupSwipeControl();
    setupNodeLaserHoverListeners();
    window.addEventListener('resize', () => {
      updateConnectingLines();
      initAllDioramas();
    });

    // Explicitly bind Dashboard filter buttons
    const dashFilterAll = document.getElementById('dash-filter-all');
    if (dashFilterAll) dashFilterAll.onclick = () => filterDashboardNodes('all');
    const dashFilterLive = document.getElementById('dash-filter-live');
    if (dashFilterLive) dashFilterLive.onclick = () => filterDashboardNodes('live');
    const dashFilterHist = document.getElementById('dash-filter-hist');
    if (dashFilterHist) dashFilterHist.onclick = () => filterDashboardNodes('story');

    // Map resize hooks
    window.addEventListener('resize', () => {
      if (worldMap) worldMap.invalidateSize();
      if (placeMap) {
        placeMap.invalidateSize();
        updateSwipePositions();
      }
    });

    // Global Operational Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      
      switch (e.key) {
        case '1':
          switchView('landing');
          break;
        case '2':
          switchView('dashboard');
          break;
        case '3':
          switchView('globe');
          break;
        case '4':
          switchView('place');
          break;
        case '5':
          switchView('story-ice');
          break;
        case 't':
        case 'T':
          startMissionTour();
          break;
        case 'Escape':
          closeStoryModal();
          if (isTourActive) exitStoryTour();
          closeStoryGuide();
          resetPhysicsProbe();
          break;
      }
    });

  } catch (err) {
    console.error('Failed to load application data:', err);
  }
});

// ==========================================================================
// 1. Isometric 3D Cryosphere Command Center Controller
// Three.js Core Earth, Dynamic SVG Connecting Lasers & Node Filter
// ==========================================================================
let coreGlobeRenderer = null;
// ==========================================================================
// 3D Micro-Environment Diorama Generators (Three.js)
// Procedural terrain dioramas representing the geomorphic structure of each hazard
// ==========================================================================
const dioramaInstances = {};

function initDiorama(containerId, createSceneFn) {
  const container = document.getElementById(containerId);
  if (!container || typeof THREE === 'undefined') return;

  if (dioramaInstances[containerId] && dioramaInstances[containerId].renderer) {
    const width = container.clientWidth || 190;
    const height = container.clientHeight || 125;
    dioramaInstances[containerId].renderer.setSize(width, height);
    if (dioramaInstances[containerId].camera) {
      dioramaInstances[containerId].camera.aspect = width / height;
      dioramaInstances[containerId].camera.updateProjectionMatrix();
    }
    return;
  }

  container.innerHTML = '';
  const width = container.clientWidth || 190;
  const height = container.clientHeight || 125;

  try {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 1.6, 2.7);
    camera.lookAt(0, 0.22, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    const terrainGroup = createSceneFn();
    scene.add(terrainGroup);

    dioramaInstances[containerId] = {
      scene,
      camera,
      renderer,
      group: terrainGroup,
      hoverSpeed: 0.005
    };
  } catch (e) {
    console.warn('Failed to init diorama:', containerId, e);
  }
}

// 1. Langtang Valley Canyon Diorama (Steep Ridge + Debris Surge)
function createLangtangValleyTerrain() {
  const group = new THREE.Group();

  const padGeo = new THREE.CylinderGeometry(0.85, 0.9, 0.08, 6);
  const padMat = new THREE.MeshBasicMaterial({ color: 0x050e18 });
  group.add(new THREE.Mesh(padGeo, padMat));
  const padWire = new THREE.Mesh(padGeo, new THREE.MeshBasicMaterial({ color: 0x00FFFF, wireframe: true, transparent: true, opacity: 0.35 }));
  group.add(padWire);

  const ridgeMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF, wireframe: true, transparent: true, opacity: 0.32 });
  
  const leftRidge = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.95, 5), ridgeMat);
  leftRidge.position.set(-0.38, 0.46, -0.1);
  leftRidge.scale.set(1, 1, 0.7);
  group.add(leftRidge);

  const rightRidge = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.78, 5), ridgeMat);
  rightRidge.position.set(0.38, 0.38, -0.15);
  rightRidge.scale.set(0.9, 1, 0.65);
  group.add(rightRidge);

  const valleyGeo = new THREE.PlaneGeometry(0.36, 0.95, 4, 8);
  const valleyMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF, wireframe: true, transparent: true, opacity: 0.7 });
  const valley = new THREE.Mesh(valleyGeo, valleyMat);
  valley.rotation.x = -Math.PI / 2;
  valley.position.set(0, 0.06, 0.05);
  group.add(valley);

  const surgeDot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), new THREE.MeshBasicMaterial({ color: 0x00FFFF }));
  surgeDot.position.set(0, 0.16, 0.15);
  group.add(surgeDot);

  const ringGeo = new THREE.RingGeometry(0.12, 0.16, 16);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
  const beaconRing = new THREE.Mesh(ringGeo, ringMat);
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.set(0, 0.17, 0.15);
  group.add(beaconRing);

  return group;
}

// 2. Suicide Glacial Basin Diorama (Stepped Caldera Rim + Drained Cavity)
function createSuicideBasinTerrain() {
  const group = new THREE.Group();

  const padGeo = new THREE.CylinderGeometry(0.85, 0.9, 0.08, 6);
  group.add(new THREE.Mesh(padGeo, new THREE.MeshBasicMaterial({ color: 0x050e18 })));
  group.add(new THREE.Mesh(padGeo, new THREE.MeshBasicMaterial({ color: 0x00FFFF, wireframe: true, transparent: true, opacity: 0.35 })));

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.14, 6, 16), new THREE.MeshBasicMaterial({ color: 0x00FFFF, wireframe: true, transparent: true, opacity: 0.35 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.2;
  group.add(rim);

  const basinFloor = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.14, 12, 2, true), new THREE.MeshBasicMaterial({ color: 0x00FFFF, wireframe: true, transparent: true, opacity: 0.6 }));
  basinFloor.position.y = 0.12;
  group.add(basinFloor);

  const water = new THREE.Mesh(new THREE.CircleGeometry(0.26, 12), new THREE.MeshBasicMaterial({ color: 0x286BFF, transparent: true, opacity: 0.55 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.08;
  group.add(water);

  const drain = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), new THREE.MeshBasicMaterial({ color: 0x00FFFF }));
  drain.position.set(0, 0.18, 0);
  group.add(drain);

  return group;
}

// 3. Chamoli Detachment Peak Diorama (Alpine Peak + Detached Wedge)
function createChamoliScarpTerrain() {
  const group = new THREE.Group();

  const padGeo = new THREE.CylinderGeometry(0.85, 0.9, 0.08, 6);
  group.add(new THREE.Mesh(padGeo, new THREE.MeshBasicMaterial({ color: 0x050e18 })));
  group.add(new THREE.Mesh(padGeo, new THREE.MeshBasicMaterial({ color: 0x286BFF, wireframe: true, transparent: true, opacity: 0.4 })));

  const peak = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.05, 4), new THREE.MeshBasicMaterial({ color: 0x286BFF, wireframe: true, transparent: true, opacity: 0.35 }));
  peak.position.set(-0.16, 0.52, -0.15);
  group.add(peak);

  const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.18), new THREE.MeshBasicMaterial({ color: 0x00FFFF, wireframe: true, transparent: true, opacity: 0.75 }));
  wedge.position.set(0.24, 0.36, 0.14);
  wedge.rotation.set(0.2, 0.3, -0.2);
  group.add(wedge);

  return group;
}

// 4. South Lhonak Moraine Lake Diorama (Moraine Dam + Breached Notch)
function createSouthLhonakTerrain() {
  const group = new THREE.Group();

  const padGeo = new THREE.CylinderGeometry(0.85, 0.9, 0.08, 6);
  group.add(new THREE.Mesh(padGeo, new THREE.MeshBasicMaterial({ color: 0x050e18 })));
  group.add(new THREE.Mesh(padGeo, new THREE.MeshBasicMaterial({ color: 0x286BFF, wireframe: true, transparent: true, opacity: 0.4 })));

  const moraine = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.1, 4, 12, Math.PI), new THREE.MeshBasicMaterial({ color: 0x286BFF, wireframe: true, transparent: true, opacity: 0.4 }));
  moraine.rotation.x = -Math.PI / 2;
  moraine.position.set(0, 0.2, 0.08);
  group.add(moraine);

  const lake = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), new THREE.MeshBasicMaterial({ color: 0x00FFFF, transparent: true, opacity: 0.45 }));
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(0, 0.18, -0.14);
  group.add(lake);

  const breach = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.32), new THREE.MeshBasicMaterial({ color: 0x00FFFF, wireframe: true, transparent: true, opacity: 0.85 }));
  breach.position.set(0, 0.15, 0.18);
  group.add(breach);

  return group;
}

function initAllDioramas() {
  initDiorama('diorama-langtang', createLangtangValleyTerrain);
  initDiorama('diorama-suicide', createSuicideBasinTerrain);
  initDiorama('diorama-chamoli', createChamoliScarpTerrain);
  initDiorama('diorama-lhonak', createSouthLhonakTerrain);
}

function animateDioramas() {
  Object.values(dioramaInstances).forEach(inst => {
    if (inst.group) {
      inst.group.rotation.y += inst.hoverSpeed || 0.005;
    }
    if (inst.renderer && inst.scene && inst.camera) {
      inst.renderer.render(inst.scene, inst.camera);
    }
  });
}

let coreGlobeScene = null;
let coreGlobeCamera = null;
let coreGlobeGroup = null;
let coreGlobeAnimId = null;
let coreGlobeInitialized = false;

function initCoreGlobe() {
  const container = document.getElementById('core-globe');
  if (!container) return;

  if (coreGlobeInitialized && coreGlobeRenderer) {
    const width = container.clientWidth || 220;
    const height = container.clientHeight || 220;
    coreGlobeRenderer.setSize(width, height);
    if (coreGlobeCamera) {
      coreGlobeCamera.aspect = width / height;
      coreGlobeCamera.updateProjectionMatrix();
    }
    return;
  }

  container.innerHTML = '';
  const width = container.clientWidth || 220;
  const height = container.clientHeight || 220;

  if (typeof THREE === 'undefined') {
    initFallbackCoreGlobe(container, width, height);
    return;
  }

  try {
    coreGlobeScene = new THREE.Scene();
    coreGlobeCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    coreGlobeCamera.position.z = 4.8;

    coreGlobeRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    coreGlobeRenderer.setSize(width, height);
    coreGlobeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(coreGlobeRenderer.domElement);

    coreGlobeGroup = new THREE.Group();
    coreGlobeGroup.rotation.x = 0.35;
    coreGlobeGroup.rotation.y = -1.2;
    coreGlobeScene.add(coreGlobeGroup);

    const textureLoader = new THREE.TextureLoader();
    // Sleek Holographic Vector Earth Sphere (Aesthetic Geo-Radar Cyber Core)
    const baseGeo = new THREE.SphereGeometry(1.46, 64, 64);
    const earthTexture = textureLoader.load('assets/earth_vector_hologram.png?v=20261107_v52', () => {
      if (coreGlobeRenderer) coreGlobeRenderer.render(coreGlobeScene, coreGlobeCamera);
    });

    const baseMat = new THREE.MeshBasicMaterial({
      map: earthTexture,
      color: 0xffffff
    });
    const baseSphere = new THREE.Mesh(baseGeo, baseMat);
    coreGlobeGroup.add(baseSphere);

    // Atmosphere Glow Backing
    const atmosGeo = new THREE.SphereGeometry(1.54, 32, 32);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x00FFFF,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide
    });
    const atmosSphere = new THREE.Mesh(atmosGeo, atmosMat);
    coreGlobeGroup.add(atmosSphere);

    // Dual Concentric Cyan Hologram Boundary Rings (Framing the rotating globe silhouette)
    const ringGroup = new THREE.Group();
    // Inner limb ring (1.465 to 1.478)
    const innerRingGeo = new THREE.RingGeometry(1.465, 1.478, 64);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x00FFFF,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    ringGroup.add(innerRing);

    // Outer atmosphere halo ring (1.520 to 1.533)
    const outerRingGeo = new THREE.RingGeometry(1.520, 1.533, 64);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x38BDF8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    ringGroup.add(outerRing);

    coreGlobeScene.add(ringGroup);

    // Pinned Hazard Coordinates on Globe
    const hazardCoords = [
      { id: 'langtang', lat: 28.25, lon: 85.50, color: 0x00FFFF },
      { id: 'suicide_basin', lat: 58.46, lon: -134.57, color: 0x00FFFF },
      { id: 'chamoli', lat: 30.38, lon: 79.73, color: 0x286BFF },
      { id: 'south_lhonak', lat: 27.91, lon: 88.20, color: 0x286BFF }
    ];

    const pinGroup = new THREE.Group();
    hazardCoords.forEach(h => {
      const phi = (90 - h.lat) * (Math.PI / 180);
      const theta = (h.lon + 180) * (Math.PI / 180);
      const r = 1.48;
      const x = -(r * Math.sin(phi) * Math.cos(theta));
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);

      const dotGeo = new THREE.SphereGeometry(0.038, 12, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: h.color });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.set(x, y, z);
      pinGroup.add(dotMesh);

      const pRingGeo = new THREE.RingGeometry(0.05, 0.07, 16);
      const pRingMat = new THREE.MeshBasicMaterial({
        color: h.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75
      });
      const pRing = new THREE.Mesh(pRingGeo, pRingMat);
      pRing.position.set(x * 1.01, y * 1.01, z * 1.01);
      pRing.lookAt(x * 2, y * 2, z * 2);
      pinGroup.add(pRing);
    });
    coreGlobeGroup.add(pinGroup);

    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let autoRotate = true;

    container.addEventListener('pointerdown', (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      autoRotate = false;
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDragging || !coreGlobeGroup) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      coreGlobeGroup.rotation.y += deltaX * 0.007;
      coreGlobeGroup.rotation.x = Math.max(-1.1, Math.min(1.1, coreGlobeGroup.rotation.x + deltaY * 0.007));
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    });

    window.addEventListener('pointerup', () => {
      isDragging = false;
      setTimeout(() => { autoRotate = true; }, 1200);
    });

    function animateCore() {
      coreGlobeAnimId = requestAnimationFrame(animateCore);

      if (autoRotate && coreGlobeGroup) {
        coreGlobeGroup.rotation.y += 0.0035;
      }

      if (coreGlobeRenderer && coreGlobeScene && coreGlobeCamera) {
        coreGlobeRenderer.render(coreGlobeScene, coreGlobeCamera);
      }

      animateDioramas();
    }

    animateCore();
    coreGlobeInitialized = true;
    initAllDioramas();

  } catch (err) {
    console.warn('Three.js core globe initialization error:', err);
    initFallbackCoreGlobe(container, width, height);
  }
}

function initFallbackCoreGlobe(container, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  container.innerHTML = '';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let angle = 0;

  function renderFallback() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = canvas.width * 0.38;

    const grad = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 1.15);
    grad.addColorStop(0, 'rgba(0, 255, 255, 0.1)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0C1B33';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#00FFFF';
    ctx.stroke();

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
    for (let lat = -60; lat <= 60; lat += 30) {
      const yOffset = cy + Math.sin(lat * Math.PI / 180) * r * 0.8;
      const rx = Math.cos(lat * Math.PI / 180) * r;
      ctx.beginPath();
      ctx.ellipse(cx, yOffset, rx, r * 0.25, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    angle += 0.01;
    for (let i = 0; i < 6; i++) {
      const a = angle + (i * Math.PI / 3);
      const rx = Math.abs(Math.sin(a)) * r;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    requestAnimationFrame(renderFallback);
  }
  renderFallback();
}

function updateConnectingLines() {
  const viewport = document.getElementById('isometric-viewport');
  const svgGroup = document.getElementById('laser-paths-group');
  const pedestal = document.getElementById('isometric-pedestal') || document.querySelector('.isometric-pedestal');

  if (!viewport || !svgGroup) return;

  const vpRect = viewport.getBoundingClientRect();
  if (vpRect.width === 0 || vpRect.height === 0) return;

  // Exact center of the chip socket
  let cx = vpRect.width / 2;
  let cy = vpRect.height * 0.56;
  let scale = 0.85;

  if (pedestal) {
    const pRect = pedestal.getBoundingClientRect();
    scale = pRect.width / 190;
    cx = pRect.left + pRect.width / 2 - vpRect.left;
    cy = pRect.top + pRect.height * (82 / 160) - vpRect.top;
  }

  // Symmetrical socket pad connection points and station targets
  const nodes = [
    { id: 'node-langtang', sxOffset: -32 * scale, syOffset: -16 * scale, targetOffset: 110 },
    { id: 'node-suicide', sxOffset: 32 * scale, syOffset: -16 * scale, targetOffset: 110 },
    { id: 'node-chamoli', sxOffset: -32 * scale, syOffset: 16 * scale, targetOffset: 25 },
    { id: 'node-lhonak', sxOffset: 32 * scale, syOffset: 16 * scale, targetOffset: 25 }
  ];

  let svgHtml = '';

  nodes.forEach(n => {
    const station = document.getElementById(n.id);
    if (!station) return;

    const sRect = station.getBoundingClientRect();
    if (sRect.width === 0 || sRect.height === 0) return;

    const isDimmed = station.classList.contains('dimmed');
    const opacity = isDimmed ? 0.15 : 1.0;

    // Station target point: centered exactly on diorama base
    const tx = sRect.left + sRect.width / 2 - vpRect.left;
    const ty = sRect.top + n.targetOffset - vpRect.top;

    // Start point exactly on the edge of the central socket pad
    const sx = cx + n.sxOffset;
    const sy = cy + n.syOffset;

    // Direct precision optical laser conduit
    const pathD = `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)}`;

    svgHtml += `
      <g class="laser-circuit-node" id="circuit-${n.id}" style="opacity: ${opacity}; transition: opacity 0.25s ease;">
        <path class="laser-circuit-base" d="${pathD}" />
        <path class="laser-circuit-path" id="pulse-${n.id}" d="${pathD}" />
        <circle class="laser-terminal-dot" cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="3.5" />
        <circle class="laser-terminal-dot" cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="2.5" />
      </g>
    `;
  });

  svgGroup.innerHTML = svgHtml;
}

function filterDashboardNodes(filterType) {
  const btns = {
    all: document.getElementById('dash-filter-all'),
    live: document.getElementById('dash-filter-live'),
    story: document.getElementById('dash-filter-hist')
  };

  Object.entries(btns).forEach(([k, btn]) => {
    if (!btn) return;
    if (k === filterType) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const liveCards = [document.getElementById('node-langtang'), document.getElementById('node-suicide')];
  const storyCards = [document.getElementById('node-chamoli'), document.getElementById('node-lhonak')];

  if (filterType === 'all') {
    liveCards.forEach(c => c && c.classList.remove('dimmed'));
    storyCards.forEach(c => c && c.classList.remove('dimmed'));
  } else if (filterType === 'live') {
    liveCards.forEach(c => c && c.classList.remove('dimmed'));
    storyCards.forEach(c => c && c.classList.add('dimmed'));
  } else if (filterType === 'story') {
    liveCards.forEach(c => c && c.classList.add('dimmed'));
    storyCards.forEach(c => c && c.classList.remove('dimmed'));
  }

  updateConnectingLines();
}

function setupNodeLaserHoverListeners() {
  const stationMap = {
    'node-langtang': 'diorama-langtang',
    'node-suicide': 'diorama-suicide',
    'node-chamoli': 'diorama-chamoli',
    'node-lhonak': 'diorama-lhonak'
  };

  Object.entries(stationMap).forEach(([id, dioramaId]) => {
    const card = document.getElementById(id);
    if (!card) return;

    card.addEventListener('mouseenter', () => {
      const pulse = document.getElementById('pulse-' + id);
      if (pulse) pulse.classList.add('fast');
      if (dioramaInstances[dioramaId]) {
        dioramaInstances[dioramaId].hoverSpeed = 0.016;
      }
    });

    card.addEventListener('mouseleave', () => {
      const pulse = document.getElementById('pulse-' + id);
      if (pulse) pulse.classList.remove('fast');
      if (dioramaInstances[dioramaId]) {
        dioramaInstances[dioramaId].hoverSpeed = 0.005;
      }
    });
  });
}

// ==========================================================================
// 2. Navigation & Case Routing
// ==========================================================================
function switchView(viewName) {
  sendClientLog('info', 'VIEW_SWITCH', 'Switched view to ' + viewName, { view: viewName });
  document.querySelectorAll('.view-section').forEach(el => {
    el.classList.remove('active');
    el.classList.add('hidden');
  });
  document.querySelectorAll('.top-nav-btn').forEach(b => b.classList.remove('active'));

  if (viewName === 'landing') {
    const l = document.getElementById('landing-view');
    if (l) {
      l.classList.remove('hidden');
      l.classList.add('active');
    }
    const btnLanding = document.getElementById('nav-btn-landing');
    if (btnLanding) btnLanding.classList.add('active');
    const lbl = document.getElementById('current-case-label');
    if (lbl) lbl.innerText = 'Mission Launchpad';
  } else if (viewName === 'dashboard' || viewName === 'world') {
    const d = document.getElementById('dashboard-view');
    if (d) {
      d.classList.remove('hidden');
      d.classList.add('active');
    }
    const btnDash = document.getElementById('nav-btn-dashboard');
    if (btnDash) btnDash.classList.add('active');
    const lbl = document.getElementById('current-case-label');
    if (lbl) lbl.innerText = '3D Cryosphere Command Center';

    initCoreGlobe();
    initAllDioramas();
    requestAnimationFrame(() => {
      updateConnectingLines();
      setTimeout(updateConnectingLines, 100);
    });
  } else if (viewName === 'globe') {
    const g = document.getElementById('globe-view');
    if (g) {
      g.classList.remove('hidden');
      g.classList.add('active');
    }
    const btnGlobe = document.getElementById('nav-btn-globe');
    if (btnGlobe) btnGlobe.classList.add('active');
    const lbl = document.getElementById('current-case-label');
    if (lbl) lbl.innerText = '3D Hazard Globe';

    setTimeout(() => {
      initCesiumGlobe();
    }, 50);
  } else if (viewName === 'story-ice' || viewName === 'story') {
    const s = document.getElementById('story-view');
    if (s) {
      s.classList.remove('hidden');
      s.classList.add('active');
    }
    const ice = document.getElementById('story-ice');
    if (ice) ice.classList.remove('hidden');

    const tabIce = document.getElementById('tab-story-ice');
    if (tabIce) {
      tabIce.classList.add('active');
      tabIce.setAttribute('aria-selected', 'true');
    }

    const lbl = document.getElementById('current-case-label');
    if (lbl) lbl.innerText = 'Ice Hazard Forensic Dossier';

    if (appData && appData.cases) {
      const storyCase = (currentCase && currentCase.type === 'story')
        ? currentCase
        : (appData.cases.find(x => x.id === 'chamoli') || appData.cases.find(x => x.type === 'story'));
      if (storyCase) {
        currentCase = storyCase;
        renderStoryScreen(storyCase);
      }
    }

    if (storyMiniMap) {
      setTimeout(() => storyMiniMap.invalidateSize(), 150);
    }
  } else if (viewName === 'place') {
    const p = document.getElementById('place-view');
    if (p) {
      p.classList.remove('hidden');
      p.classList.add('active');
    }
    if (placeMap) {
      setTimeout(() => {
        placeMap.invalidateSize();
        if (currentCase) {
          placeMap.fitBounds(currentCase.location.bounds, { padding: [30, 30], maxZoom: 13 });
          updateSwipePositions();
        }
      }, 150);
    }
  }

  // Manage active view classes on body
  document.body.classList.remove('view-dashboard', 'view-landing', 'view-globe', 'view-place', 'view-story');
  if (viewName === 'dashboard' || viewName === 'world') {
    document.body.classList.add('view-dashboard');
  } else {
    document.body.classList.add('view-' + viewName);
  }

  // Discard brand identity block on 3D Dashboard header
  const brandGroup = document.querySelector('.brand-group');
  if (brandGroup) {
    if (viewName === 'dashboard' || viewName === 'world') {
      brandGroup.style.display = 'none';
    } else {
      brandGroup.style.display = 'flex';
    }
  }

  updateToolbarContext(viewName);
}

function updateToolbarContext(viewName) {
  const panelMap = {
    'landing': 'toolbar-landing-context',
    'dashboard': 'toolbar-dashboard-filters',
    'world': 'toolbar-dashboard-filters',
    'globe': 'toolbar-globe-context',
    'place': 'toolbar-place-context',
    'story': 'toolbar-story-context',
    'story-ice': 'toolbar-story-context'
  };

  const contextIds = [
    'toolbar-landing-context',
    'toolbar-dashboard-filters',
    'toolbar-globe-context',
    'toolbar-place-context',
    'toolbar-story-context'
  ];

  const targetId = panelMap[viewName] || 'toolbar-dashboard-filters';

  contextIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === targetId) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  // Sync toolbar globe filter state if switching to globe
  if (viewName === 'globe') {
    const btnAll = document.getElementById('toolbar-globe-filter-all');
    const btnIce = document.getElementById('toolbar-globe-filter-ice');
    if (btnAll) btnAll.classList.toggle('active', currentGlobeFilter === 'all');
    if (btnIce) btnIce.classList.toggle('active', currentGlobeFilter === 'ice');
  }
}


// ==========================================================================
// Interactive Story Card Modal System
// ==========================================================================
let activeModalCaseId = 'langtang';

function openStoryModal(caseId) {
  activeModalCaseId = caseId;
  const c = appData.cases ? appData.cases.find(x => x.id === caseId) : null;
  if (!c) {
    selectCase(caseId);
    return;
  }

  const modal = document.getElementById('story-card-modal');
  if (!modal) return;

  const kickerEl = document.getElementById('modal-case-kicker');
  const badgeEl = document.getElementById('modal-case-badge');
  const dotEl = document.getElementById('modal-pulse-dot');
  const titleEl = document.getElementById('modal-story-title');
  const coordsEl = document.getElementById('modal-story-coords');
  const narrativeEl = document.getElementById('modal-story-narrative');
  const preImg = document.getElementById('modal-pre-img');
  const postImg = document.getElementById('modal-post-img');
  const m1Val = document.getElementById('modal-m1-val');
  const m1Lbl = document.getElementById('modal-m1-lbl');
  const m2Val = document.getElementById('modal-m2-val');
  const m2Lbl = document.getElementById('modal-m2-lbl');
  const m3Val = document.getElementById('modal-m3-val');
  const m3Lbl = document.getElementById('modal-m3-lbl');

  const lat = (c.location && typeof c.location.lat === 'number') ? c.location.lat : 28.0;
  const lon = (c.location && typeof c.location.lon === 'number') ? c.location.lon : 85.0;
  const locName = (c.name && c.name.includes(','))
    ? c.name.split(',').slice(1).join(',').trim()
    : (c.location && c.location.name ? c.location.name : 'CRYOSPHERE ZONE');

  if (titleEl) titleEl.innerText = c.name ? c.name.split(',')[0] : 'Cryosphere Hazard';
  if (coordsEl) coordsEl.innerText = locName.toUpperCase() + ' • ' + Math.abs(lat).toFixed(2) + '°' + (lat >= 0 ? 'N' : 'S') + ', ' + Math.abs(lon).toFixed(2) + '°' + (lon >= 0 ? 'E' : 'W');
  
  const isLive = c.type === 'live';
  if (kickerEl) kickerEl.innerText = isLive ? 'LIVE NISAR RADAR // CRYOSPHERE' : 'FORENSIC DOSSIER // CRYOSPHERE GLOF';
  if (badgeEl) {
    badgeEl.innerText = isLive ? '● LIVE NISAR' : '▲ HISTORICAL';
    badgeEl.className = 'modal-badge ' + (isLive ? 'live' : 'story');
  }
  if (dotEl) {
    dotEl.className = 'modal-pulse-dot ' + (isLive ? 'live' : 'story');
  }

  // Populate narrative
  if (narrativeEl) {
    if (caseId === 'langtang') {
      narrativeEl.innerText = 'Catastrophic cliff collapse impounded the canyon riverbed. NISAR L-band penetrates cloud cover to isolate the +6.2 dB roughness change and surface deformation.';
    } else if (caseId === 'suicide_basin') {
      narrativeEl.innerText = 'Subglacial jökulhlaup draining under Mendenhall Glacier. Radar isolates the sudden loss of specular reflection as tens of millions of cubic meters of water drain violently downstream.';
    } else if (caseId === 'chamoli') {
      narrativeEl.innerText = '27 million m³ hanging glacier detachment triggered a hyper-concentrated flash flood destroying downstream hydro infrastructure. Pre-collapse InSAR creep was detectable.';
    } else if (caseId === 'south_lhonak') {
      narrativeEl.innerText = 'Catastrophic moraine dam burst breached into Teesta river. Heavy cloud cover concealed surge from optical imaging while L-band SAR mapped water loss.';
    } else {
      narrativeEl.innerText = (c.story && c.story.what) ? c.story.what : (c.description || '');
    }
  }

  // Populate metrics
  if (caseId === 'langtang') {
    if (m1Val) m1Val.innerText = '+6.2 dB'; if (m1Lbl) m1Lbl.innerText = 'SURGE CONTRAST';
    if (m2Val) m2Val.innerText = '11.4 cm'; if (m2Lbl) m2Lbl.innerText = 'InSAR CREEP';
    if (m3Val) m3Val.innerText = '3.42 km²'; if (m3Lbl) m3Lbl.innerText = 'DEBRIS AREA';
  } else if (caseId === 'suicide_basin') {
    if (m1Val) m1Val.innerText = '31M m³'; if (m1Lbl) m1Lbl.innerText = 'DISCHARGE';
    if (m2Val) m2Val.innerText = '1.12 km²'; if (m2Lbl) m2Lbl.innerText = 'DRAINED BED';
    if (m3Val) m3Val.innerText = '+6.8 dB'; if (m3Lbl) m3Lbl.innerText = 'ROUGHNESS LOSS';
  } else if (caseId === 'chamoli') {
    if (m1Val) m1Val.innerText = '27M m³'; if (m1Lbl) m1Lbl.innerText = 'MASS COLLAPSE';
    if (m2Val) m2Val.innerText = '3,800 m'; if (m2Lbl) m2Lbl.innerText = 'SCARP ALTITUDE';
    if (m3Val) m3Val.innerText = 'PRE-LAUNCH'; if (m3Lbl) m3Lbl.innerText = 'FORENSIC';
  } else if (caseId === 'south_lhonak') {
    if (m1Val) m1Val.innerText = '168 ha'; if (m1Lbl) m1Lbl.innerText = 'LAKE LOSS';
    if (m2Val) m2Val.innerText = '5,200 m'; if (m2Lbl) m2Lbl.innerText = 'DAM ALTITUDE';
    if (m3Val) m3Val.innerText = '100%'; if (m3Lbl) m3Lbl.innerText = 'CLOUD BLIND OPT';
  }

  // Images
  if (preImg) {
    if (c.radar_products && c.radar_products.pre_gcov) {
      preImg.src = c.radar_products.pre_gcov;
    } else {
      preImg.src = 'assets/langtang_pre.png';
    }
  }
  if (postImg) {
    if (c.radar_products && c.radar_products.post_gcov) {
      postImg.src = c.radar_products.post_gcov;
    } else {
      postImg.src = 'assets/langtang_post.png';
    }
  }

  modal.classList.remove('hidden');
}

function closeStoryModal() {
  const modal = document.getElementById('story-card-modal');
  if (modal) modal.classList.add('hidden');
}

function launchModalRadarLab() {
  closeStoryModal();
  selectCase(activeModalCaseId);
}

function launchModalDossier() {
  closeStoryModal();
  switchView('story-ice');
  const c = appData.cases ? appData.cases.find(x => x.id === activeModalCaseId) : null;
  if (c) renderStoryScreen(c);
}

function selectCase(caseId) {
  sendClientLog('info', 'CASE_SELECT', 'Selected case study ' + caseId, { caseId: caseId });
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }

  const c = appData.cases.find(x => x.id === caseId);
  if (!c) return;

  const loader = document.getElementById('radar-skeleton-loader');
  if (loader && c.type === 'live') {
    loader.classList.remove('hidden');
    loader.style.opacity = '1';
  }

  currentCase = c;
  const lbl = document.getElementById('current-case-label');
  if (lbl) lbl.innerText = c.name.split(',')[0];

  setTimeout(() => {
    if (c.type === 'live') {
      switchView('place');
      renderPlaceScreen(c);
    } else {
      switchView('story');
      renderStoryScreen(c);
    }
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.classList.add('hidden'), 250);
    }
  }, 100);
}

let advancedDiagnosticsVisible = false;
function toggleAdvancedDiagnostics() {
  advancedDiagnosticsVisible = !advancedDiagnosticsVisible;
  const advGroup = document.getElementById('advanced-signals');
  const hud = document.getElementById('physics-probe-hud');
  const btn = document.getElementById('btn-toggle-advanced');
  
  if (advGroup) {
    advGroup.classList.toggle('hidden', !advancedDiagnosticsVisible);
  }
  if (hud) {
    hud.classList.toggle('hidden', !advancedDiagnosticsVisible);
  }
  if (btn) {
    btn.innerHTML = advancedDiagnosticsVisible ? '<span>⚙️</span> Diagnostics: ON' : '<span>⚙️</span> Advanced';
    btn.classList.toggle('bg-sky-500/20', advancedDiagnosticsVisible);
    btn.classList.toggle('text-sky-300', advancedDiagnosticsVisible);
    btn.classList.toggle('border-sky-400/40', advancedDiagnosticsVisible);
  }
}

// ==========================================================================
// 3. Place Screen (Live NISAR Explorer)
// ==========================================================================
function renderPlaceScreen(c) {
  document.getElementById('place-site-name').innerText = c.name;
  const tag = document.getElementById('place-badge-tag');
  tag.className = `tag-pill ${c.type === 'live' ? 'tag-live' : 'tag-story'}`;
  tag.innerText = c.badge;

  document.getElementById('date-label-pre').innerText = c.pre_date;
  document.getElementById('date-label-post').innerText = c.post_date;
  document.getElementById('disp-pol').innerText = c.polarization;
  document.getElementById('swath-track').innerText = c.track;
  document.getElementById('swath-frame').innerText = c.frame;
  document.getElementById('swath-pass').innerText = c.direction;

  document.getElementById('impact-heading').innerText = `Observation: ${c.event_date}`;
  document.getElementById('impact-narrative').innerHTML = `
    <strong>${c.story.what_happened}</strong><br><br>
    ${c.story.what_radar_shows}
  `;

  // Render Feature Navigation Pills
  const featureRow = document.getElementById('feature-pills-row');
  if (c.features && c.features.length) {
    featureRow.innerHTML = c.features.map((f, i) => `
      <button class="feature-quick-pill" onclick="focusFeature(${i})">
        ${f.title}
      </button>
    `).join('');
  } else {
    featureRow.innerHTML = '';
  }

  if (c.id === 'langtang') {
    document.getElementById('tile-stat-1').innerText = `${c.metrics.debris_area_km2} km²`;
    document.getElementById('tile-lbl-1').innerText = 'Debris Deposit Footprint';
    document.getElementById('tile-stat-2').innerText = `${c.metrics.flooded_area_km2} km²`;
    document.getElementById('tile-lbl-2').innerText = 'Impounded River Water';
    document.getElementById('tile-stat-3').innerText = `${c.metrics.threshold_db} dB`;
    document.getElementById('tile-lbl-3').innerText = '3σ Significance Floor';
    document.getElementById('tile-stat-4').innerText = `${c.metrics.max_pre_creep_cm} cm`;
    document.getElementById('tile-lbl-4').innerText = 'InSAR Creep (Line-of-Sight LOS)';
  } else {
    document.getElementById('tile-stat-1').innerText = `${c.metrics.drained_basin_km2} km²`;
    document.getElementById('tile-lbl-1').innerText = 'Drained Basin Extent';
    document.getElementById('tile-stat-2').innerText = c.metrics.lake_volume_m3;
    document.getElementById('tile-lbl-2').innerText = 'Discharged Lake Volume';
    document.getElementById('tile-stat-3').innerText = `${c.metrics.threshold_db} dB`;
    document.getElementById('tile-lbl-3').innerText = '3σ Significance Floor';
    document.getElementById('tile-stat-4').innerText = c.metrics.radar_contrast_db;
    document.getElementById('tile-lbl-4').innerText = 'Bed Exposure (Δσ⁰ dB)';
  }

  const list = document.getElementById('physics-bullet-list');
  list.innerHTML = `
    <li><strong>Geometric Constraints:</strong> ${c.limits.radar_limits}</li>
    <li><strong>Calibration Level:</strong> ${c.limits.provisional_status}</li>
    <li><strong>Empirical Threshold:</strong> Changes under &plusmn;${c.metrics.threshold_db} dB are strictly masked as baseline natural terrain variations.</li>
  `;

  // Update Recommended Next Exploration Card
  const nextTitle = document.getElementById('next-case-title');
  const nextDesc = document.getElementById('next-case-desc');
  const nextBtnLbl = document.getElementById('next-case-btn-label');
  if (c.id === 'langtang') {
    if (nextTitle) nextTitle.innerText = 'Suicide Basin Lake Drainage (GLOF)';
    if (nextDesc) nextDesc.innerText = "See how Alaska's ice dam did the opposite: a 31M m³ glacier lake drained subglacially in 36 hours.";
    if (nextBtnLbl) nextBtnLbl.innerText = 'Explore Suicide Basin';
    nextCaseTargetId = 'suicide_basin';
  } else {
    if (nextTitle) nextTitle.innerText = 'Langtang Valley Avalanche & Dam';
    if (nextDesc) nextDesc.innerText = 'See how 3.42 km² of pulverized rock and ice dammed the valley canyon in Nepal.';
    if (nextBtnLbl) nextBtnLbl.innerText = 'Explore Langtang Valley';
    nextCaseTargetId = 'langtang';
  }

  // Mobile initial setup: default sidebar collapsed on screens < 768px so map has 100% space
  if (window.innerWidth < 768) {
    sidebarVisible = false;
    document.querySelector('.place-explorer-layout')?.classList.add('sidebar-collapsed');
    const sideBtn = document.getElementById('btn-toggle-sidebar');
    if (sideBtn) sideBtn.innerHTML = '📊 Narrative';
  } else {
    sidebarVisible = true;
    document.querySelector('.place-explorer-layout')?.classList.remove('sidebar-collapsed');
    const sideBtn = document.getElementById('btn-toggle-sidebar');
    if (sideBtn) sideBtn.innerHTML = '📊 Sidebar: ON';
  }

  // Update Radar Pairs & GCOV Observation Schedule Card
  if (c.gcov_passes) {
    const beforeEl = document.getElementById('gcov-before-dates');
    const afterEl = document.getElementById('gcov-after-dates');
    if (beforeEl) beforeEl.innerText = c.gcov_passes.before.map(d => {
      const parts = d.split('-');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10);
    }).join(', ');
    if (afterEl) afterEl.innerText = c.gcov_passes.after.map(d => {
      const parts = d.split('-');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10);
    }).join(', ');
  }

  if (c.radar_pairs && c.radar_pairs.length >= 3) {
    const p0 = document.getElementById('pair-date-control');
    const p1 = document.getElementById('pair-date-spans');
    const p2 = document.getElementById('pair-date-after');
    if (p0) p0.innerText = c.radar_pairs[0].dates;
    if (p1) p1.innerText = c.radar_pairs[1].dates;
    if (p2) p2.innerText = c.radar_pairs[2].dates;
    selectRadarPair('spans');
  }

  initTimelineUI(c);
  initPlaceMap(c);
  setSignalLayer('diff');
}

function selectRadarPair(pairType) {
  sendClientLog('info', 'RADAR_PAIR', 'Radar pair matrix tab: ' + pairType, { pairType: pairType });
  if (!currentCase || !currentCase.radar_pairs) return;
  document.querySelectorAll('.pair-tab-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById('pair-btn-' + pairType);
  if (activeBtn) activeBtn.classList.add('active');

  const pair = currentCase.radar_pairs.find(p => p.type === pairType) || currentCase.radar_pairs[1];
  const nameEl = document.getElementById('pair-detail-name');
  const prodsEl = document.getElementById('pair-detail-products');
  const roleEl = document.getElementById('pair-detail-role');

  if (nameEl) nameEl.innerText = `${pair.name.toUpperCase()} (${pair.dates})`;
  if (prodsEl) prodsEl.innerText = pair.products;
  if (roleEl) roleEl.innerText = pair.role;

  if (pairType === 'spans') {
    setSignalLayer('diff');
  } else if (pairType === 'control') {
    setSignalLayer('creep');
  } else if (pairType === 'after') {
    setSignalLayer('heatmap');
  }
}

function initPlaceMap(c) {
  if (!placeMap) {
    placeMap = L.map('place-map', {
      center: [c.location.lat, c.location.lon],
      zoom: c.location.zoom,
      minZoom: 8,
      maxZoom: 16,
      zoomControl: false,
      worldCopyJump: false,
      maxBounds: [[-85, -180], [85, 180]],
      tap: false // iOS Safari optimization: prevents 300ms delay and input range conflicts
    });

    L.control.zoom({ position: 'bottomright' }).addTo(placeMap);

    currentTileLayerPlace = L.tileLayer(ESRI_SATELLITE_URL, {
      attribution: ESRI_ATTRIBUTION,
      maxZoom: 18,
      noWrap: true
    }).addTo(placeMap);

    placeMap.on('move moveend zoomend', updateSwipePositions);
    placeMap.on('mousemove', (e) => updatePhysicsProbe(e.latlng));
    placeMap.on('mouseout', resetPhysicsProbe);

    placeMap.on('movestart dragstart', () => {
      document.querySelector('.sar-viewport-col')?.classList.add('map-panning');
    });
    placeMap.on('moveend dragend', () => {
      document.querySelector('.sar-viewport-col')?.classList.remove('map-panning');
    });
  } else {
    placeMap.setView([c.location.lat, c.location.lon], c.location.zoom);
  }

  // Remove existing overlays & pins
  [preOverlay, postOverlay, compOverlay, heatOverlay, creepOverlay, hhOverlay, hvOverlay, timelineOverlay, swathBoundaryRect, featureMarkerGroup].forEach(l => {
    if (l && placeMap.hasLayer(l)) placeMap.removeLayer(l);
  });

  const bounds = c.location.bounds;

  // Swath Footprint boundary
  swathBoundaryRect = L.rectangle(bounds, {
    color: '#38bdf8',
    weight: 2,
    dashArray: '6, 6',
    fillOpacity: 0.04
  }).addTo(placeMap);

  // Raster overlays with explicit build-versioning
  const vTag = appData.build_id ? `?v=${appData.build_id}` : '';
  preOverlay = L.imageOverlay(c.radar_products.pre_gcov + vTag, bounds, { opacity: 1.0 }).addTo(placeMap);
  postOverlay = L.imageOverlay(c.radar_products.post_gcov + vTag, bounds, { opacity: 1.0 }).addTo(placeMap);

  preOverlay.on('load', updateSwipePositions);
  postOverlay.on('load', updateSwipePositions);
  compOverlay = L.imageOverlay(c.radar_products.composite + vTag, bounds, { opacity: 0.95 });
  heatOverlay = L.imageOverlay(c.radar_products.heatmap + vTag, bounds, { opacity: 0.95 });
  creepOverlay = L.imageOverlay(c.radar_products.displacement + vTag, bounds, { opacity: 0.92 });
  if (c.radar_products.hh) {
    hhOverlay = L.imageOverlay(c.radar_products.hh + vTag, bounds, { opacity: 1.0 });
  }
  if (c.radar_products.hv) {
    hvOverlay = L.imageOverlay(c.radar_products.hv + vTag, bounds, { opacity: 1.0 });
  }

  // Add Feature Annotation Pins
  featureMarkerGroup = L.layerGroup();
  if (c.features) {
    c.features.forEach((f, idx) => {
      const pinHtml = `
        <div class="geo-pin-badge" id="pin-badge-${idx}">
          <span class="pin-symbol">📍</span>
          <span class="pin-title">${f.title}</span>
        </div>
      `;
      const pinIcon = L.divIcon({
        html: pinHtml,
        className: 'custom-geo-pin',
        iconSize: [140, 28],
        iconAnchor: [12, 14]
      });

      const marker = L.marker([f.lat, f.lon], { icon: pinIcon });
      marker.bindPopup(`
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; color: #0f172a; padding: 4px; max-width: 240px;">
          <h4 style="margin: 0 0 4px; font-size: 13px; font-weight: 800; color: #0284c7;">${f.title}</h4>
          <p style="margin: 0; font-size: 11px; line-height: 1.45; color: #334155;">${f.desc}</p>
        </div>
      `);
      featureMarkerGroup.addLayer(marker);
    });
  }

  if (showFeaturePins) {
    featureMarkerGroup.addTo(placeMap);
  }

  placeMap.invalidateSize();
  placeMap.fitBounds(bounds, { padding: [25, 25], maxZoom: 13 });

  setTimeout(() => {
    if (placeMap) {
      placeMap.invalidateSize();
      placeMap.fitBounds(bounds, { padding: [25, 25], maxZoom: 13 });
      updateSwipePositions();
    }
  }, 100);
}

function recenterPlaceMap() {
  if (placeMap && currentCase) {
    placeMap.invalidateSize();
    placeMap.fitBounds(currentCase.location.bounds, { padding: [25, 25], maxZoom: 13 });
    setTimeout(updateSwipePositions, 100);
  }
}

function focusFeature(index) {
  if (!placeMap || !currentCase || !currentCase.features) return;
  const f = currentCase.features[index];
  placeMap.flyTo([f.lat, f.lon], 14, { duration: 1.0 });

  // Open corresponding popup
  if (featureMarkerGroup) {
    const layers = featureMarkerGroup.getLayers();
    if (layers[index]) {
      layers[index].openPopup();
    }
  }
}

function toggleFeaturePins() {
  showFeaturePins = !showFeaturePins;
  const btn = document.getElementById('btn-toggle-pins');
  if (showFeaturePins) {
    if (featureMarkerGroup && !placeMap.hasLayer(featureMarkerGroup)) {
      featureMarkerGroup.addTo(placeMap);
    }
    btn.innerHTML = '📍 Feature Labels: ON';
    btn.style.color = '#38bdf8';
  } else {
    if (featureMarkerGroup && placeMap.hasLayer(featureMarkerGroup)) {
      placeMap.removeLayer(featureMarkerGroup);
    }
    btn.innerHTML = '📍 Feature Labels: OFF';
    btn.style.color = '#94a3b8';
  }
}

function toggleBasemap() {
  if (!placeMap) return;
  const btn = document.getElementById('btn-toggle-basemap');
  
  if (currentBasemap === 'satellite') {
    currentBasemap = 'topo';
    placeMap.removeLayer(currentTileLayerPlace);
    currentTileLayerPlace = L.tileLayer(OSM_TOPO_URL, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19
    }).addTo(placeMap);
    currentTileLayerPlace.bringToBack();
    btn.innerHTML = '🗺️ OpenTopo Map';
  } else {
    currentBasemap = 'satellite';
    placeMap.removeLayer(currentTileLayerPlace);
    currentTileLayerPlace = L.tileLayer(ESRI_SATELLITE_URL, {
      attribution: ESRI_ATTRIBUTION,
      maxZoom: 18
    }).addTo(placeMap);
    currentTileLayerPlace.bringToBack();
    btn.innerHTML = '🛰️ Satellite Earth';
  }
}

let sidebarVisible = typeof window !== 'undefined' ? window.innerWidth >= 768 : true;
function toggleSidebar() {
  sidebarVisible = !sidebarVisible;
  const layout = document.querySelector('.place-explorer-layout');
  const btn = document.getElementById('btn-toggle-sidebar');
  if (layout) {
    layout.classList.toggle('sidebar-collapsed', !sidebarVisible);
  }
  if (btn) {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      btn.innerHTML = sidebarVisible ? '📊 Sheet: ON' : '📊 Narrative';
    } else {
      btn.innerHTML = sidebarVisible ? '📊 Sidebar: ON' : '📊 Sidebar: OFF';
    }
    btn.style.color = sidebarVisible ? 'var(--text-primary)' : 'var(--text-muted)';
  }
  if (placeMap) {
    setTimeout(() => {
      placeMap.invalidateSize();
      if (currentCase) {
        placeMap.fitBounds(currentCase.location.bounds, { padding: [25, 25], maxZoom: 13 });
      }
      updateSwipePositions();
    }, 200);
  }
}

// ==========================================================================
// 4. Signal Layer Switcher & Swipe Divider Logic
// ==========================================================================
function setSignalLayer(mode) {
  currentSignal = mode;
  document.querySelectorAll('.sig-pill').forEach(b => b.classList.remove('active'));

  const swipeUI = document.getElementById('swipe-overlay-ui');
  const legend = document.getElementById('dynamic-legend');
  const legendHeadline = document.getElementById('legend-headline');
  const legendGrad = document.getElementById('legend-gradient-bar');
  const scaleMin = document.getElementById('scale-min');
  const scaleMax = document.getElementById('scale-max');
  const legendNote = document.getElementById('legend-footer-note');
  const tsPlayer = document.getElementById('timeseries-player');

  if (mode !== 'timeseries') {
    if (tsPlayer) tsPlayer.classList.add('hidden');
    if (isTimelinePlaying) toggleTimelinePlay();
  }

  [preOverlay, postOverlay, compOverlay, heatOverlay, creepOverlay, hhOverlay, hvOverlay, timelineOverlay].forEach(l => {
    if (l && placeMap.hasLayer(l)) placeMap.removeLayer(l);
  });

  if (mode === 'diff') {
    document.getElementById('pill-diff').classList.add('active');
    swipeUI.style.display = 'block';
    legend.classList.add('hidden');

    preOverlay.addTo(placeMap);
    postOverlay.addTo(placeMap);
    updateSwipePositions();

  } else if (mode === 'composite') {
    document.getElementById('pill-composite').classList.add('active');
    swipeUI.style.display = 'none';
    legend.classList.remove('hidden');

    legendHeadline.innerText = 'Dual-Pol False Color Composite (HH / HV)';
    legendGrad.style.background = 'linear-gradient(to right, #0077ff 0%, #00d4ff 30%, #ffd700 70%, #ff4400 100%)';
    scaleMin.innerText = 'Electric Blue (Water)';
    scaleMax.innerText = 'Golden / Orange (Debris)';
    legendNote.innerText = 'Colorized Dual-Pol Composite: Water appears electric blue due to specular reflection. Rough avalanche debris & gravel appear golden-orange.';

    compOverlay.addTo(placeMap);

  } else if (mode === 'hh') {
    const btn = document.getElementById('pill-hh');
    if (btn) btn.classList.add('active');
    swipeUI.style.display = 'none';
    legend.classList.remove('hidden');

    legendHeadline.innerText = 'HH Co-Polarization (Dielectric Constant & Specular Mirror)';
    legendGrad.style.background = 'linear-gradient(to right, #000000 0%, #334155 35%, #94a3b8 70%, #ffffff 100%)';
    scaleMin.innerText = '≤ -24 dB (Specular Water)';
    scaleMax.innerText = '≥ 0 dB (Foreshortened Rock)';
    legendNote.innerText = 'HH co-pol: Sensitive to dielectric permittivity (water = black specular mirror, bedrock/soil = bright surface bounce).';

    if (hhOverlay) hhOverlay.addTo(placeMap);

  } else if (mode === 'hv') {
    const btn = document.getElementById('pill-hv');
    if (btn) btn.classList.add('active');
    swipeUI.style.display = 'none';
    legend.classList.remove('hidden');

    legendHeadline.innerText = 'HV Cross-Polarization (Surface Roughness & Volumetric Scatter)';
    legendGrad.style.background = 'linear-gradient(to right, #050505 0%, #3b0764 30%, #7e22ce 60%, #facc15 100%)';
    scaleMin.innerText = '≤ -30 dB (Calm Water / Noise Floor)';
    scaleMax.innerText = '≥ -8 dB (Rough Debris Boulders)';
    legendNote.innerText = 'HV cross-pol: Depolarization occurs when radar pulses hit angular crushed boulders and chaotic ice rubble (k·σ_h ≫ 1).';

    if (hvOverlay) hvOverlay.addTo(placeMap);

  } else if (mode === 'heatmap') {
    document.getElementById('pill-heatmap').classList.add('active');
    swipeUI.style.display = 'none';
    legend.classList.remove('hidden');

    legendHeadline.innerText = 'Backscatter Change Intensity (Δσ⁰ dB)';
    legendGrad.style.background = 'linear-gradient(to right, #0099ff 0%, #0099ff 20%, transparent 20%, transparent 80%, #ff4400 80%, #ff1100 100%)';
    scaleMin.innerText = '≤ -3 dB (Water)';
    scaleMax.innerText = '≥ +6 dB (Rough Debris)';
    legendNote.innerText = 'Transparent pixels = undisturbed terrain within 3σ noise floor (< 2.8 dB).';

    postOverlay.addTo(placeMap);
    heatOverlay.addTo(placeMap);

    if (postOverlay.getElement()) {
      postOverlay.getElement().style.clipPath = 'none';
    }

  } else if (mode === 'creep') {
    document.getElementById('pill-creep').classList.add('active');
    swipeUI.style.display = 'none';
    legend.classList.remove('hidden');

    legendHeadline.innerText = 'Pre-Collapse Creep (InSAR GUNW Phase)';
    legendGrad.style.background = 'linear-gradient(to right, #facc15, #a855f7, #ec4899)';
    scaleMin.innerText = '0 cm (Stable)';
    scaleMax.innerText = '≥ 12 cm (Active Downslope Creep)';
    legendNote.innerText = 'Computed from interferometric phase: Δr = -(λ/4π)Δϕ. Masked in low-coherence snow.';

    postOverlay.addTo(placeMap);
    creepOverlay.addTo(placeMap);

    if (postOverlay.getElement()) {
      postOverlay.getElement().style.clipPath = 'none';
    }

  } else if (mode === 'timeseries') {
    if (typeof isTourActive !== 'undefined' && isTourActive) {
      exitStoryTour();
    }
    const btn = document.getElementById('pill-timeseries');
    if (btn) btn.classList.add('active');
    swipeUI.style.display = 'none';
    legend.classList.add('hidden');

    if (tsPlayer) tsPlayer.classList.remove('hidden');

    if (currentCase && currentCase.timeline) {
      setTimelineStep(currentTimelineIndex);
    }
  }
}

function setupSwipeControl() {
  const slider = document.getElementById('swipe-slider');
  const divider = document.getElementById('swipe-divider-line');
  const hint = document.getElementById('swipe-hint-pill');

  if (!slider) return;

  const dismissHint = () => {
    if (hint) hint.classList.add('opacity-0', 'pointer-events-none');
    if (divider) divider.classList.remove('initial-wiggle');
  };

  slider.addEventListener('input', () => {
    dismissHint();
    updateSwipePositions();
  });
  slider.addEventListener('mousedown', dismissHint);
  slider.addEventListener('touchstart', dismissHint, { passive: true });

  setTimeout(() => {
    if (divider) divider.classList.remove('initial-wiggle');
  }, 2500);
}

function updateSwipePositions() {
  if (currentSignal !== 'diff') return;

  const slider = document.getElementById('swipe-slider');
  const divider = document.getElementById('swipe-divider-line');
  const container = document.getElementById('map-viewport-wrapper');
  
  if (!slider || !divider || !container || !postOverlay) return;

  const imageElement = postOverlay.getElement();
  if (!imageElement) {
    requestAnimationFrame(updateSwipePositions);
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const imageRect = imageElement.getBoundingClientRect();

  if (containerRect.width === 0 || imageRect.width === 0) {
    setTimeout(updateSwipePositions, 60);
    return;
  }

  const sliderVal = parseFloat(slider.value) / 100.0;

  // Compute slider x-position directly clamped across the image overlay
  const imgLeft = Math.max(0, imageRect.left - containerRect.left);
  const imgRight = Math.min(containerRect.width, imageRect.right - containerRect.left);
  const imgWidth = Math.max(1, imgRight - imgLeft);

  const dividerPixelX = imgLeft + sliderVal * imgWidth;
  divider.style.left = `${dividerPixelX}px`;

  // Calculate clip percentage within image element:
  // Clipping inset(0 0 0 leftClip%) hides the left portion of postOverlay,
  // revealing preOverlay on the left and keeping postOverlay visible on the right
  const clipLeftPercent = Math.max(0, Math.min(100, sliderVal * 100));
  imageElement.style.clipPath = `inset(0 0 0 ${clipLeftPercent}%)`;
  imageElement.style.webkitClipPath = `inset(0 0 0 ${clipLeftPercent}%)`;
}

// ==========================================================================
// 5. Story Screen (Historical Baselines)
// ==========================================================================
function renderStoryScreen(c) {
  document.getElementById('story-article-title').innerText = c.name;
  document.getElementById('story-event-date').innerText = c.event_date;
  
  // Req 3: Explicit "Story - No NISAR Data" badge
  document.getElementById('story-article-pathway').innerHTML = `
    <span class="badge-story-no-nisar font-mono">⚠️ STORY — NO NISAR DATA (HISTORICAL FORENSIC BASELINE)</span>
    <span class="badge-pathway font-mono">PATHWAY: ${c.pathway ? c.pathway.toUpperCase() : 'GLACIAL HAZARD'}</span>
  `;

  document.getElementById('story-text-what').innerText = c.story.what_happened;
  document.getElementById('story-text-why').innerText = c.story.why_it_happened;
  document.getElementById('story-text-radar').innerText = c.story.what_radar_would_show;
  document.getElementById('story-text-limits').innerText = c.story.limits;

  // Req 4: Prominently formatted Sources section
  const sourcesList = document.getElementById('story-sources-list');
  sourcesList.innerHTML = (c.sources || []).map(s => `
    <li class="story-source-item">
      <span class="source-bullet">📄</span>
      <div class="source-text-wrap">
        <span class="source-title">${s}</span>
        <span class="source-tag font-mono">PRIMARY SCIENTIFIC REFERENCE</span>
      </div>
    </li>
  `).join('');

  initStoryMiniMap(c);
}

function initStoryMiniMap(c) {
  if (!storyMiniMap) {
    storyMiniMap = L.map('story-mini-map', {
      center: [c.location.lat, c.location.lon],
      zoom: c.location.zoom,
      maxZoom: 14,
      zoomControl: false
    });

    L.tileLayer(ESRI_SATELLITE_URL, {
      attribution: ESRI_ATTRIBUTION
    }).addTo(storyMiniMap);
  } else {
    storyMiniMap.setView([c.location.lat, c.location.lon], c.location.zoom);
  }

  storyMiniMap.eachLayer(l => {
    if (l instanceof L.Marker || l instanceof L.Rectangle) storyMiniMap.removeLayer(l);
  });

  L.marker([c.location.lat, c.location.lon]).addTo(storyMiniMap);
  if (c.location.bounds) {
    L.rectangle(c.location.bounds, { color: '#38bdf8', weight: 1.5, fillOpacity: 0.15 }).addTo(storyMiniMap);
  }

  setTimeout(() => storyMiniMap.invalidateSize(), 150);
}

// ==========================================================================
// 6. Modal Guide Controller
// ==========================================================================
function openStoryGuide() {
  document.getElementById('guide-modal').classList.remove('hidden');
}

function closeStoryGuide(e) {
  if (e && e.target && e.target.closest('.modal-dialog')) return;
  document.getElementById('guide-modal').classList.add('hidden');
}

// ==========================================================================
// 7. Radar Physics Probe HUD Controller
// ==========================================================================
function resetPhysicsProbe() {
  const coordsEl = document.getElementById('probe-coords');
  const sigmaEl = document.getElementById('probe-sigma');
  const deltaEl = document.getElementById('probe-delta');
  const polEl = document.getElementById('probe-pol');
  const iconEl = document.getElementById('probe-mech-icon');
  const nameEl = document.getElementById('probe-mech-name');
  const descEl = document.getElementById('probe-mech-desc');

  if (!coordsEl) return;
  coordsEl.innerText = 'Hover over radar swath';
  sigmaEl.innerText = '--';
  deltaEl.innerText = '--';
  polEl.innerText = '--';
  iconEl.innerText = '🔬';
  nameEl.innerText = 'Move cursor over radar swath';
  descEl.innerText = 'Inspect surface roughness (k·σ_h) and dielectric permittivity (ε_r) across the terrain.';
}

function updatePhysicsProbe(latlng) {
  if (!currentCase || !currentCase.location || !currentCase.location.bounds) return;

  const coordsEl = document.getElementById('probe-coords');
  const sigmaEl = document.getElementById('probe-sigma');
  const deltaEl = document.getElementById('probe-delta');
  const polEl = document.getElementById('probe-pol');
  const iconEl = document.getElementById('probe-mech-icon');
  const nameEl = document.getElementById('probe-mech-name');
  const descEl = document.getElementById('probe-mech-desc');

  if (!coordsEl) return;

  const bounds = L.latLngBounds(currentCase.location.bounds);
  if (!bounds.contains(latlng)) {
    resetPhysicsProbe();
    coordsEl.innerText = 'Outside Swath Footprint';
    return;
  }

  // Inside Swath Footprint
  coordsEl.innerText = `${latlng.lat.toFixed(3)}°N, ${latlng.lng.toFixed(3)}°E`;

  if (currentCase.id === 'langtang') {
    // 1. Impounded Lake (28.25, 85.50)
    const dLake = Math.hypot((latlng.lat - 28.25) / 0.028, (latlng.lng - 85.50) / 0.028);
    // 2. Debris Dam (28.21, 85.53)
    const dDam = Math.hypot((latlng.lat - 28.21) / 0.032, (latlng.lng - 85.53) / 0.035);
    // 3. Detachment Scarp (28.34, 85.42)
    const dScarp = Math.hypot((latlng.lat - 28.34) / 0.032, (latlng.lng - 85.42) / 0.032);
    // 4. Avalanche Chute (28.28, 85.46)
    const dChute = Math.hypot((latlng.lat - 28.28) / 0.025, (latlng.lng - 85.46) / 0.025);

    if (dLake < 1.0) {
      sigmaEl.innerText = '-18.6 dB';
      deltaEl.innerText = '-6.4 dB';
      polEl.innerText = 'HH: Specular | HV: Null';
      iconEl.innerText = '🌊';
      nameEl.innerText = 'Specular Mirror Reflection (High Dielectric)';
      descEl.innerText = 'Impounded river water (ε_r ≈ 80) acts as a smooth specular mirror, reflecting radar pulses away from the receiver.';
    } else if (dDam < 1.15) {
      sigmaEl.innerText = '-6.8 dB';
      deltaEl.innerText = '+5.8 dB';
      polEl.innerText = 'HH: -6.8 | HV: -11.2 dB';
      iconEl.innerText = '🪨';
      nameEl.innerText = 'Rough Debris Dam (Volumetric Scatter)';
      descEl.innerText = 'Shattered boulders and angular ice rubble create high surface roughness (k·σ_h ≫ 1), depolarizing the radar pulse into bright HV.';
    } else if (dScarp < 1.0) {
      sigmaEl.innerText = '-7.9 dB';
      deltaEl.innerText = '+3.1 dB';
      polEl.innerText = 'Creep: 11.4 cm';
      iconEl.innerText = '🏔️';
      nameEl.innerText = 'Detachment Scarp (Bedrock Failure)';
      descEl.innerText = 'High-altitude headwall. InSAR GUNW phase revealed 11.4 cm of downslope creep prior to catastrophic detachment.';
    } else if (dChute < 1.0) {
      sigmaEl.innerText = '-8.5 dB';
      deltaEl.innerText = '+4.2 dB';
      polEl.innerText = 'HH / HV Diffuse';
      iconEl.innerText = '⚡';
      nameEl.innerText = 'Avalanche Chute (Scoured Couloir)';
      descEl.innerText = 'Steep mountain couloir stripped to bare bedrock and scoured by pulverized ice-rock flow.';
    } else {
      const u = (latlng.lng - 85.25) / 0.50;
      const isFacing = Math.sin(u * 14 + latlng.lat * 10) > 0.15;
      if (isFacing) {
        sigmaEl.innerText = '-9.2 dB';
        deltaEl.innerText = '±0.4 dB';
        polEl.innerText = 'HH > HV (Surface)';
        iconEl.innerText = '🏔️';
        nameEl.innerText = 'Slope Foreshortening (Radar Facing)';
        descEl.innerText = 'Mountain face inclined toward the descending NISAR look angle, compressing radar returns into brighter pixels.';
      } else {
        sigmaEl.innerText = '-14.1 dB';
        deltaEl.innerText = '0.0 dB';
        polEl.innerText = 'Moraine Baseline';
        iconEl.innerText = '🌲';
        nameEl.innerText = 'Stable Himalayan Moraine';
        descEl.innerText = 'Undisturbed terrain within the 3σ noise floor (< 2.82 dB). Stable backscatter.';
      }
    }
  } else if (currentCase.id === 'suicide_basin') {
    const dBasin = Math.hypot((latlng.lat - 58.483) / 0.016, (latlng.lng - (-134.560)) / 0.020);
    const dDam = Math.hypot((latlng.lat - 58.485) / 0.016, (latlng.lng - (-134.572)) / 0.016);
    const dLake = Math.hypot((latlng.lat - 58.428) / 0.018, (latlng.lng - (-134.568)) / 0.020);

    if (dBasin < 1.0) {
      sigmaEl.innerText = '-11.4 dB';
      deltaEl.innerText = '+6.8 dB';
      polEl.innerText = 'HH: -11.4 | HV: -16.4 dB';
      iconEl.innerText = '🕳️';
      nameEl.innerText = 'Drained Basin Floor (Rough Ice & Bedrock)';
      descEl.innerText = '31M m³ of lake water drained through subglacial tunnels. Exposed basin bed is covered with stranded ice blocks and rough gravel (+6.8 dB backscatter jump).';
    } else if (dDam < 1.0) {
      sigmaEl.innerText = '-12.0 dB';
      deltaEl.innerText = '+1.4 dB';
      polEl.innerText = 'Dam Flexure: 8.2 cm';
      iconEl.innerText = '❄️';
      nameEl.innerText = 'Mendenhall Lateral Ice Dam';
      descEl.innerText = 'Impounding ice wall of Mendenhall Glacier that deforms under hydrostatic pressure before floating to unseal subglacial tunnels.';
    } else if (dLake < 1.0) {
      sigmaEl.innerText = '-16.8 dB';
      deltaEl.innerText = '-4.5 dB';
      polEl.innerText = 'Surge Specular Mirror';
      iconEl.innerText = '🌊';
      nameEl.innerText = 'Mendenhall Lake Surge Terminus';
      descEl.innerText = 'Peak outburst discharge of 34,000 cfs surged into Mendenhall Lake, causing record crests and valley inundation.';
    } else {
      sigmaEl.innerText = '-13.8 dB';
      deltaEl.innerText = '0.0 dB';
      polEl.innerText = 'Mendenhall Trunk';
      iconEl.innerText = '🏔️';
      nameEl.innerText = 'Mendenhall Glacier Trunk';
      descEl.innerText = '300m-thick main glacial ice stream flowing south from the Juneau Icefield.';
    }
  }
}

// ==========================================================================
// 8. Time-Series Animation Scrub Bar ("The Waltz of the Ice")
// ==========================================================================
function initTimelineUI(c) {
  if (!c || !c.timeline || !c.timeline.length) return;
  currentTimelineIndex = 0;
  if (isTimelinePlaying) toggleTimelinePlay();

  const nodesBar = document.getElementById('timeline-nodes-bar');
  const slider = document.getElementById('ts-slider');
  if (slider) {
    slider.min = 0;
    slider.max = c.timeline.length - 1;
    slider.value = 0;
  }

  if (nodesBar) {
    if (c.id === 'langtang') {
      nodesBar.innerHTML = `
        <button class="ts-node-pill active" id="ts-node-0" onclick="setTimelineStep(0)" title="${c.timeline[0].label}: ${c.timeline[0].note}">
          ${c.timeline[0].date.slice(5)} (Pass 1)
        </button>
        <button class="ts-node-pill" id="ts-node-1" onclick="setTimelineStep(1)" title="${c.timeline[1].label}: ${c.timeline[1].note}">
          ${c.timeline[1].date.slice(5)} (Control)
        </button>
        <div class="timeline-gap-pill disabled font-mono" title="24-Day Swath Gap: July 27 – August 18, 2026 (Satellite imaging alternate global swaths)">
          <span class="gap-hatch-stripes"></span>
          <span>SWATH GAP (JUL 27 – AUG 18)</span>
        </div>
        <button class="ts-node-pill" id="ts-node-2" onclick="setTimelineStep(2)" title="${c.timeline[2].label}: ${c.timeline[2].note}">
          ${c.timeline[2].date.slice(5)} (Pre-Event)
        </button>
        <div class="timeline-event-marker font-mono" title="Event Date: August 26, 2026 (Avalanche & Debris Dam)">
          <span>⚡ EVENT: AUG 26</span>
        </div>
        <button class="ts-node-pill" id="ts-node-3" onclick="setTimelineStep(3)" title="${c.timeline[3].label}: ${c.timeline[3].note}">
          ${c.timeline[3].date.slice(5)} (Post-Event)
        </button>
        <button class="ts-node-pill" id="ts-node-4" onclick="setTimelineStep(4)" title="${c.timeline[4].label}: ${c.timeline[4].note}">
          ${c.timeline[4].date.slice(5)} (Breach)
        </button>
        <button class="ts-node-pill" id="ts-node-5" onclick="setTimelineStep(5)" title="${c.timeline[5].label}: ${c.timeline[5].note}">
          ${c.timeline[5].date.slice(5)} (Stabilized)
        </button>
      `;
    } else if (c.id === 'suicide_basin') {
      nodesBar.innerHTML = `
        <button class="ts-node-pill active" id="ts-node-0" onclick="setTimelineStep(0)" title="${c.timeline[0].label}: ${c.timeline[0].note}">
          ${c.timeline[0].date.slice(5)} (Pass 1)
        </button>
        <button class="ts-node-pill" id="ts-node-1" onclick="setTimelineStep(1)" title="${c.timeline[1].label}: ${c.timeline[1].note}">
          ${c.timeline[1].date.slice(5)} (Control)
        </button>
        <div class="timeline-gap-pill disabled font-mono" title="24-Day Swath Gap: July 19 – August 10, 2026 (Satellite imaging alternate global swaths)">
          <span class="gap-hatch-stripes"></span>
          <span>SWATH GAP (JUL 19 – AUG 10)</span>
        </div>
        <button class="ts-node-pill" id="ts-node-2" onclick="setTimelineStep(2)" title="${c.timeline[2].label}: ${c.timeline[2].note}">
          ${c.timeline[2].date.slice(5)} (Peak Lake)
        </button>
        <div class="timeline-event-marker font-mono" title="Event Date: August 13, 2026 (Jökulhlaup Crest)">
          <span>⚡ CREST: AUG 13</span>
        </div>
        <button class="ts-node-pill" id="ts-node-3" onclick="setTimelineStep(3)" title="${c.timeline[3].label}: ${c.timeline[3].note}">
          ${c.timeline[3].date.slice(5)} (Drained)
        </button>
        <button class="ts-node-pill" id="ts-node-4" onclick="setTimelineStep(4)" title="${c.timeline[4].label}: ${c.timeline[4].note}">
          ${c.timeline[4].date.slice(5)} (Response)
        </button>
        <button class="ts-node-pill" id="ts-node-5" onclick="setTimelineStep(5)" title="${c.timeline[5].label}: ${c.timeline[5].note}">
          ${c.timeline[5].date.slice(5)} (Stabilized)
        </button>
      `;
    } else {
      nodesBar.innerHTML = c.timeline.map((step, idx) => `
        <button class="ts-node-pill ${idx === 0 ? 'active' : ''}" id="ts-node-${idx}" onclick="setTimelineStep(${idx})" title="${step.label}: ${step.note}">
          ${step.date.slice(5)} (${step.label.split(' ')[0]})
        </button>
      `).join('');
    }
  }

  updateTimelineStatus(c.timeline[0], 0, c.timeline.length);
}

function updateTimelineStatus(step, index, total) {
  const dateDisp = document.getElementById('ts-date-display');
  const phaseDisp = document.getElementById('ts-phase-note');
  const orbitLbl = document.getElementById('ts-orbit-label');
  const slider = document.getElementById('ts-slider');

  if (dateDisp) dateDisp.innerText = step.date;
  if (phaseDisp) phaseDisp.innerText = step.label;
  if (orbitLbl) orbitLbl.innerText = `Orbit ${index + 1} of ${total}`;
  if (slider) slider.value = index;

  document.querySelectorAll('.ts-node-pill').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
}

function setTimelineStep(index) {
  if (!currentCase || !currentCase.timeline || !currentCase.timeline[index]) return;
  currentTimelineIndex = index;
  const step = currentCase.timeline[index];
  const bounds = currentCase.location.bounds;
  const vTag = appData.build_id ? `?v=${appData.build_id}` : '';

  updateTimelineStatus(step, index, currentCase.timeline.length);

  // Update map overlay
  if (timelineOverlay && placeMap.hasLayer(timelineOverlay)) {
    placeMap.removeLayer(timelineOverlay);
  }

  timelineOverlay = L.imageOverlay(step.image + vTag, bounds, { opacity: 1.0 });
  if (currentSignal === 'timeseries') {
    timelineOverlay.addTo(placeMap);
  }

  // Update narrative in sidebar
  const impactNarrative = document.getElementById('impact-narrative');
  if (impactNarrative) {
    impactNarrative.innerHTML = `
      <strong style="color: #38bdf8;">Orbit Pass ${step.cycle} (${step.date}): ${step.label}</strong><br><br>
      ${step.note}
    `;
  }
}

function stepTimeline(dir) {
  if (!currentCase || !currentCase.timeline) return;
  let next = currentTimelineIndex + dir;
  if (next < 0) next = currentCase.timeline.length - 1;
  if (next >= currentCase.timeline.length) next = 0;
  setTimelineStep(next);
}

function onTimelineSlider(val) {
  setTimelineStep(parseInt(val, 10));
}

let nextCaseTargetId = 'suicide_basin';
function goToNextCase() {
  if (nextCaseTargetId) {
    selectCase(nextCaseTargetId);
  }
}

function toggleTimelinePlay() {
  isTimelinePlaying = !isTimelinePlaying;
  const icon = document.getElementById('ts-play-icon');

  if (isTimelinePlaying) {
    if (typeof isTourActive !== 'undefined' && isTourActive) {
      exitStoryTour();
    }
    if (icon) icon.innerText = '⏸';
    if (currentSignal !== 'timeseries') {
      setSignalLayer('timeseries');
    }
    timelineInterval = setInterval(() => {
      stepTimeline(1);
    }, 1800);
  } else {
    if (icon) icon.innerText = '▶';
    if (timelineInterval) {
      clearInterval(timelineInterval);
      timelineInterval = null;
    }
  }
}

// ==========================================================================
// 8. Guided Story Tour (Step 4: Scrollytelling Walkthrough)
// ==========================================================================
let currentTourStep = 0;
let isTourActive = false;
let tourHighlightMarker = null;

function startStoryTour() {
  if (!placeMap || !currentCase || !currentCase.features || currentCase.features.length === 0) return;
  
  // Mutual exclusion: pause & hide time-series, hide physics HUD
  if (typeof isTimelinePlaying !== 'undefined' && isTimelinePlaying) {
    toggleTimelinePlay();
  }
  const tsPlayer = document.getElementById('timeseries-player');
  if (tsPlayer) tsPlayer.classList.add('hidden');
  const hud = document.getElementById('physics-probe-hud');
  if (hud) hud.classList.add('hidden');

  isTourActive = true;
  currentTourStep = 0;
  
  const tourCard = document.getElementById('story-tour-card');
  if (tourCard) {
    tourCard.classList.remove('hidden');
  }

  renderTourStep(0);
}

function exitStoryTour() {
  isTourActive = false;
  const tourCard = document.getElementById('story-tour-card');
  if (tourCard) {
    tourCard.classList.add('hidden');
  }
  if (tourHighlightMarker && placeMap && placeMap.hasLayer(tourHighlightMarker)) {
    placeMap.removeLayer(tourHighlightMarker);
    tourHighlightMarker = null;
  }
  recenterPlaceMap();
}

function startMissionTour(caseId) {
  const targetId = caseId || (currentCase ? currentCase.id : 'langtang');
  const c = appData.cases ? appData.cases.find(x => x.id === targetId) : null;
  if (!c) return;

  currentCase = c;
  const lbl = document.getElementById('current-case-label');
  if (lbl) lbl.innerText = c.name.split(',')[0];

  switchView('place');
  renderPlaceScreen(c);

  setTimeout(() => {
    if (placeMap) {
      placeMap.invalidateSize();
      updateSwipePositions();
    }
    startStoryTour();
  }, 350);
}

function togglePhysicsProbeHUD() {
  const hud = document.getElementById('physics-probe-hud');
  if (!hud) return;
  if (hud.classList.contains('hidden')) {
    hud.classList.remove('hidden');
  } else {
    hud.classList.add('hidden');
    resetPhysicsProbe();
  }
}

function stepStoryTour(delta) {
  if (!currentCase || !currentCase.features) return;
  const total = currentCase.features.length;
  let nextStep = currentTourStep + delta;
  if (nextStep < 0) nextStep = 0;
  if (nextStep >= total) {
    exitStoryTour();
    return;
  }
  renderTourStep(nextStep);
}

function goToTourStep(index) {
  if (!currentCase || !currentCase.features) return;
  if (index >= 0 && index < currentCase.features.length) {
    renderTourStep(index);
  }
}

function renderTourStep(stepIdx) {
  if (!currentCase || !currentCase.features) return;
  currentTourStep = stepIdx;
  const total = currentCase.features.length;
  const feat = currentCase.features[stepIdx];

  // Update Badge, Title, Narrative
  const badge = document.getElementById('tour-step-badge');
  const title = document.getElementById('tour-step-title');
  const desc = document.getElementById('tour-step-desc');
  const nextBtn = document.getElementById('tour-btn-next');
  const prevBtn = document.getElementById('tour-btn-prev');

  if (badge) badge.innerText = `STEP ${stepIdx + 1} OF ${total}`;
  if (title) title.innerText = feat.title;
  if (desc) desc.innerText = feat.desc;

  const progressFill = document.getElementById('tour-progress-fill');
  if (progressFill) {
    progressFill.style.width = `${((stepIdx + 1) / total) * 100}%`;
  }

  if (prevBtn) {
    prevBtn.style.opacity = stepIdx === 0 ? '0.4' : '1';
    prevBtn.style.pointerEvents = stepIdx === 0 ? 'none' : 'auto';
  }
  if (nextBtn) {
    nextBtn.innerText = stepIdx === total - 1 ? 'Finish ✓' : 'Next Step →';
  }

  // Update Dots
  const dots = document.querySelectorAll('.tour-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === stepIdx);
    dot.classList.toggle('bg-sky-400', i === stepIdx);
    dot.classList.toggle('bg-slate-700', i !== stepIdx);
  });

  // Camera flight to target coordinates
  if (placeMap) {
    placeMap.flyTo([feat.lat, feat.lon], 14, { duration: 1.4 });
    
    // Add pulsing visual beacon at feature position
    if (tourHighlightMarker && placeMap.hasLayer(tourHighlightMarker)) {
      placeMap.removeLayer(tourHighlightMarker);
    }
    const pulseIcon = L.divIcon({
      html: `<div style="width: 32px; height: 32px; border-radius: 50%; border: 3px solid #38bdf8; background: rgba(56, 189, 248, 0.25); box-shadow: 0 0 16px #38bdf8; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`,
      className: 'tour-pulse-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    tourHighlightMarker = L.marker([feat.lat, feat.lon], { icon: pulseIcon }).addTo(placeMap);
  }

  // Smart Signal & Layer Automation
  if (stepIdx === 0) {
    setSignalLayer(currentCase.id === 'langtang' ? 'creep' : 'diff');
  } else if (stepIdx === 1) {
    setSignalLayer('diff');
    setSwipeSlider(45);
  } else if (stepIdx === 2) {
    setSignalLayer('heatmap');
  } else if (stepIdx === 3) {
    setSignalLayer('diff');
    setSwipeSlider(75);
  }
}

function setSwipeSlider(val) {
  const slider = document.getElementById('swipe-slider');
  if (slider) {
    slider.value = val;
    updateSwipePositions();
  }
}

// ==========================================================================
// 12. 3D CESIUM GLOBE CONTROLLER (#globe-view) — IgnitronDev Style
// ==========================================================================
let cesiumViewer = null;
let currentGlobeFilter = 'all';
let fallbackGlobeInstance = null;

const GLOBE_TARGETS = {
  all: {
    lat: 30.0,
    lon: 30.0,
    altitude: 19000000.0,
    pitch: -85.0,
    heading: 0.0
  },
  ice: {
    lat: 28.5,
    lon: 84.5,
    altitude: 980000.0,
    pitch: -52.0,
    heading: 5.0
  },
  volcano: {
    lat: 64.0,
    lon: -22.0,
    altitude: 520000.0,
    pitch: -48.0,
    heading: -10.0
  }
};

const GLOBE_PINS_DATA = [
  {
    id: 'langtang',
    name: 'Langtang Avalanche',
    category: 'ice',
    lat: 28.25,
    lon: 85.50,
    color: '#00E5FF',
    label: 'LANGTANG [LIVE SAR]',
    labelOffset: [0, 8]
  },
  {
    id: 'suicide_basin',
    name: 'Suicide Basin Jökulhlaup',
    category: 'ice',
    lat: 58.46,
    lon: -134.57,
    color: '#00E5FF',
    label: 'SUICIDE BASIN [LIVE SAR]',
    labelOffset: [0, 8]
  },
  {
    id: 'chamoli',
    name: 'Chamoli Ice Detachment',
    category: 'ice',
    lat: 30.38,
    lon: 79.73,
    color: '#38BDF8',
    label: 'CHAMOLI [STORY]',
    labelOffset: [-45, -14]
  },
  {
    id: 'south_lhonak',
    name: 'South Lhonak Moraine Burst',
    category: 'ice',
    lat: 27.91,
    lon: 88.20,
    color: '#38BDF8',
    label: 'SOUTH LHONAK [STORY]',
    labelOffset: [48, 14]
  }
];


function extractCaseIdFromCesiumPick(picked) {
  if (!picked || !picked.id) return null;
  const ent = picked.id;
  let raw = null;
  if (typeof ent === 'string') {
    raw = ent;
  } else if (ent.caseId) {
    raw = ent.caseId;
  } else if (ent.id && typeof ent.id === 'string') {
    raw = ent.id;
  } else if (ent.properties) {
    try {
      if (typeof ent.properties.caseId === 'object' && typeof ent.properties.caseId.getValue === 'function') {
        raw = ent.properties.caseId.getValue();
      } else if (ent.properties.caseId) {
        raw = ent.properties.caseId;
      }
    } catch (e) {}
  }
  if (typeof raw === 'string') {
    return raw.replace(/-glow-beam|-laser-core|-orbital-head|-flare|-billboard/, '').trim();
  }
  return null;
}

function handleGlobeBeaconClick(caseId) {
  sendClientLog('info', 'BEACON_CLICK', '3D Globe beacon clicked: ' + caseId, { caseId: caseId });
  if (!caseId) return;
  const c = appData.cases ? appData.cases.find(x => x.id === caseId) : null;
  if (!c) {
    selectCase(caseId);
    return;
  }

  const lbl = document.getElementById('current-case-label');
  if (lbl) lbl.innerText = c.name.split(',')[0];

  if (cesiumViewer && typeof Cesium !== 'undefined' && cesiumViewer.camera) {
    const pin = GLOBE_PINS_DATA.find(p => p.id === caseId);
    const lat = pin ? pin.lat : ((c.location && typeof c.location.lat === 'number') ? c.location.lat : 28.0);
    const lon = pin ? pin.lon : ((c.location && typeof c.location.lon === 'number') ? c.location.lon : 85.0);

    let navigated = false;
    const doNav = () => {
      if (!navigated) {
        navigated = true;
        selectCase(caseId);
      }
    };

    // Safety timeout in case flyTo animation doesn't fire complete callback
    const timer = setTimeout(doNav, 1100);

    try {
      cesiumViewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, 380000.0),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-55.0),
          roll: 0.0
        },
        duration: 0.9,
        complete: () => {
          clearTimeout(timer);
          doNav();
        },
        cancel: () => {
          clearTimeout(timer);
          doNav();
        }
      });
    } catch (err) {
      clearTimeout(timer);
      doNav();
    }
  } else {
    selectCase(caseId);
  }
}

function initCesiumGlobe() {
  const container = document.getElementById('cesiumContainer');
  if (!container) return;

  if (typeof Cesium !== 'undefined') {
    if (!cesiumViewer) {
      try {
        if (Cesium.Ion) {
          Cesium.Ion.defaultAccessToken = '';
        }

        // Photorealistic Earth Imagery Layer (100% reliable local asset)
        cesiumViewer = new Cesium.Viewer('cesiumContainer', {
          contextOptions: {
            webgl: {
              alpha: true
            }
          },
          orderIndependentTranslucency: false,
          baseLayer: false,
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          baseLayerPicker: false,
          animation: false,
          timeline: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          infoBox: false,
          selectionIndicator: false,
          fullscreenButton: false,
          skyAtmosphere: false,
          skyBox: false
        });

        // 1. Local Photographic NASA Blue Marble Satellite Base (Instant 0ms load)
        try {
          const localSatellite = new Cesium.SingleTileImageryProvider({
            url: 'assets/earth_real.jpg?v=20261107_v53'
          });
          cesiumViewer.imageryLayers.addImageryProvider(localSatellite);
        } catch (localErr) {
          console.warn('Local NASA Blue Marble load error:', localErr);
        }

        // 2. High-Resolution ESRI World Imagery Satellite Layer (Streams real satellite zoom)
        try {
          const esriSatellite = new Cesium.UrlTemplateImageryProvider({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            maximumLevel: 19,
            credit: 'Esri World Imagery / NASA / Maxar'
          });
          cesiumViewer.imageryLayers.addImageryProvider(esriSatellite);
        } catch (esriErr) {
          console.warn('ESRI Satellite provider error:', esriErr);
        }

        // 3. High-Resolution Polar Cap Seamless Fillers (Eliminates Web Mercator 85.05° polar clipping)
        try {
          const northPoleCap = new Cesium.SingleTileImageryProvider({
            url: 'assets/north_pole_cap.png?v=20261107_v53',
            rectangle: Cesium.Rectangle.fromDegrees(-180.0, 84.0, 180.0, 90.0)
          });
          cesiumViewer.imageryLayers.addImageryProvider(northPoleCap);

          const southPoleCap = new Cesium.SingleTileImageryProvider({
            url: 'assets/south_pole_cap.png?v=20261107_v53',
            rectangle: Cesium.Rectangle.fromDegrees(-180.0, -90.0, 180.0, -84.0)
          });
          cesiumViewer.imageryLayers.addImageryProvider(southPoleCap);
        } catch (polarErr) {
          console.warn('Polar cap provider error:', polarErr);
        }

        // Scene atmosphere & realistic lighting (Transparent scene reveals starry background)
        cesiumViewer.scene.backgroundColor = (Cesium.Color && Cesium.Color.TRANSPARENT) ? Cesium.Color.TRANSPARENT : new Cesium.Color(0, 0, 0, 0);
        if (cesiumViewer.scene.globe) {
          cesiumViewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#05080E');
          cesiumViewer.scene.globe.enableLighting = false;
          cesiumViewer.scene.globe.showGroundAtmosphere = false;
        }

        // ScreenSpaceEventHandler for clicking 3D pins and bookmarks
        if (cesiumViewer.screenSpaceEventHandler) {
          cesiumViewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        }
        const handler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.scene.canvas);
        handler.setInputAction(click => {
          let picked = cesiumViewer.scene.pick(click.position);
          if (!Cesium.defined(picked) || !picked.id) {
            if (typeof cesiumViewer.scene.drillPick === 'function') {
              const drill = cesiumViewer.scene.drillPick(click.position, 5);
              if (drill && drill.length > 0) picked = drill[0];
            }
          }
          if (Cesium.defined(picked) && picked.id) {
            const caseId = extractCaseIdFromCesiumPick(picked);
            if (caseId) {
              handleGlobeBeaconClick(caseId);
            }
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Hover cursor pointer with case entity detection
        handler.setInputAction(movement => {
          let picked = cesiumViewer.scene.pick(movement.endPosition);
          if (!Cesium.defined(picked) || !picked.id) {
            if (typeof cesiumViewer.scene.drillPick === 'function') {
              const drill = cesiumViewer.scene.drillPick(movement.endPosition, 3);
              if (drill && drill.length > 0) picked = drill[0];
            }
          }
          const caseId = (Cesium.defined(picked) && picked.id) ? extractCaseIdFromCesiumPick(picked) : null;
          cesiumViewer.scene.canvas.style.cursor = caseId ? 'pointer' : 'default';

          // Real-time geodetic coordinate tracking on mousemove
          try {
            const ray = cesiumViewer.camera.getPickRay(movement.endPosition);
            if (ray && cesiumViewer.scene.globe) {
              const cartesian = cesiumViewer.scene.globe.pick(ray, cesiumViewer.scene);
              if (cartesian) {
                const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                const latDeg = Cesium.Math.toDegrees(cartographic.latitude);
                const lonDeg = Cesium.Math.toDegrees(cartographic.longitude);
                const latStr = `${Math.abs(latDeg).toFixed(2)}°${latDeg >= 0 ? 'N' : 'S'}`;
                const lonStr = `${Math.abs(lonDeg).toFixed(2)}°${lonDeg >= 0 ? 'E' : 'W'}`;
                const altKm = (cesiumViewer.camera.positionCartographic.height / 1000).toFixed(0);
                const readoutEl = document.getElementById('globe-coords-readout');
                if (readoutEl) {
                  readoutEl.innerText = `GEO-TARGET: ${latStr}, ${lonStr} // SENSOR ALT: ${altKm} KM SSO`;
                }
              }
            }
          } catch (e) {
            // Ray outside globe horizon
          }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // Subtle idle rotation when user is not dragging
        let lastUserInteraction = Date.now();
        cesiumViewer.scene.canvas.addEventListener('pointerdown', () => { lastUserInteraction = Date.now(); }, { passive: true });
        cesiumViewer.scene.canvas.addEventListener('wheel', () => { lastUserInteraction = Date.now(); }, { passive: true });

        cesiumViewer.scene.postRender.addEventListener(() => {
          if (Date.now() - lastUserInteraction > 3500) {
            cesiumViewer.scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, 0.0003);
          }
        });

        renderCesiumPins(currentGlobeFilter);
        applyGlobeFilter(currentGlobeFilter);
      } catch (err) {
        console.warn('Cesium initialization failed, using high-contrast dark globe fallback:', err);
        initFallbackGlobe();
      }
    } else {
      cesiumViewer.resize();
    }
  } else {
    initFallbackGlobe();
  }
}

function renderCesiumPins(type) {
  if (!cesiumViewer || typeof Cesium === 'undefined') return;

  cesiumViewer.entities.removeAll();

  const filtered = type === 'all'
    ? GLOBE_PINS_DATA
    : GLOBE_PINS_DATA.filter(c => c.category === type);

  filtered.forEach(c => {
    const offset = c.labelOffset || [0, 8];
    const beamColor = Cesium.Color.fromCssColorString(c.color || '#00E5FF');
    const beamAlt = 420000; // 420 km altitude (orbital laser beacon)

    // 1. Ground holographic contact hotspot / flare disc
    const groundFlareCanvas = createBeaconFlareCanvas(c.color || '#00E5FF');
    const flareEnt = cesiumViewer.entities.add({
      id: c.id,
      name: c.name,
      properties: { caseId: c.id },
      position: Cesium.Cartesian3.fromDegrees(c.lon, c.lat, 100),
      billboard: {
        image: groundFlareCanvas,
        width: 36,
        height: 36,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      },
      label: {
        text: c.label,
        font: '10px "JetBrains Mono", monospace',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.fromCssColorString('#E0F2FE'),
        outlineColor: Cesium.Color.fromCssColorString('#020617'),
        outlineWidth: 3,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(8, 12, 20, 0.88)'),
        showBackground: true,
        backgroundPadding: new Cesium.Cartesian2(6, 4),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(offset[0], offset[1] - 12)
      }
    });
    flareEnt.caseId = c.id;

    // 2. Volumetric Glowing Laser Pillar (Shoots straight up into space)
    const beamEnt = cesiumViewer.entities.add({
      id: c.id + '-glow-beam',
      name: c.name,
      properties: { caseId: c.id },
      polyline: {
        positions: [
          Cesium.Cartesian3.fromDegrees(c.lon, c.lat, 0),
          Cesium.Cartesian3.fromDegrees(c.lon, c.lat, beamAlt)
        ],
        width: 18,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.35,
          taperPower: 0.65,
          color: beamColor
        })
      }
    });
    beamEnt.caseId = c.id;

    // 3. Ultra-Bright White Laser Core
    const coreEnt = cesiumViewer.entities.add({
      id: c.id + '-laser-core',
      name: c.name,
      properties: { caseId: c.id },
      polyline: {
        positions: [
          Cesium.Cartesian3.fromDegrees(c.lon, c.lat, 0),
          Cesium.Cartesian3.fromDegrees(c.lon, c.lat, beamAlt)
        ],
        width: 3.5,
        material: new Cesium.ColorMaterialProperty(Cesium.Color.WHITE)
      }
    });
    coreEnt.caseId = c.id;

    // 4. Orbital Beacon Head / Waypoint Marker at the top of the beam
    const headEnt = cesiumViewer.entities.add({
      id: c.id + '-orbital-head',
      name: c.name,
      properties: { caseId: c.id },
      position: Cesium.Cartesian3.fromDegrees(c.lon, c.lat, beamAlt),
      point: {
        pixelSize: 7,
        color: Cesium.Color.WHITE,
        outlineColor: beamColor,
        outlineWidth: 2
      }
    });
    headEnt.caseId = c.id;
  });
}

function createBeaconFlareCanvas(colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const cx = 32;
  const cy = 32;

  // Outer radial glow halo
  const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 30);
  grad.addColorStop(0, '#FFFFFF');
  grad.addColorStop(0.2, colorHex);
  grad.addColorStop(0.55, 'rgba(0, 229, 255, 0.45)');
  grad.addColorStop(1, 'rgba(0, 229, 255, 0)');
  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Concentric target pulse ring
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = colorHex;
  ctx.stroke();

  // Intense center core hotspot
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  return canvas;
}

function createPinCanvas(colorHex, isVolcano) {
  return createBeaconFlareCanvas(colorHex);
}

function applyGlobeFilter(type) {
  sendClientLog('info', 'GLOBE_FILTER', 'Globe hazard filter set to ' + type, { filter: type });
  currentGlobeFilter = type;

  // Update filter button UI states for both floating globe panel and vertical toolbar
  ['all', 'ice'].forEach(t => {
    const btn1 = document.getElementById('globe-filter-' + t);
    const btn2 = document.getElementById('toolbar-globe-filter-' + t);
    [btn1, btn2].forEach(btn => {
      if (btn) {
        if (t === type) {
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
        } else {
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        }
      }
    });
  });

  const target = GLOBE_TARGETS[type] || GLOBE_TARGETS.all;

  if (cesiumViewer && typeof Cesium !== 'undefined') {
    renderCesiumPins(type);

    cesiumViewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(target.lon, target.lat, target.altitude),
      orientation: {
        heading: Cesium.Math.toRadians(target.heading),
        pitch: Cesium.Math.toRadians(target.pitch),
        roll: 0.0
      },
      duration: 2.2
    });
  } else if (fallbackGlobeInstance) {
    fallbackGlobeInstance.setFilter(type);
  }
}

function initFallbackGlobe() {
  const container = document.getElementById('cesiumContainer');
  if (!container) return;
  if (fallbackGlobeInstance) return;

  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'fallback-globe-canvas';
  container.appendChild(canvas);

  let width = container.clientWidth || 800;
  let height = container.clientHeight || 600;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  let rotX = 0.35;
  let rotY = -0.5;
  let targetRotX = 0.35;
  let targetRotY = -0.5;
  let targetScale = 1.0;
  let currentScale = 1.0;
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  function resize() {
    width = container.clientWidth || 800;
    height = container.clientHeight || 600;
    canvas.width = width;
    canvas.height = height;
  }
  window.addEventListener('resize', resize);

  canvas.addEventListener('mousedown', e => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    targetRotY += dx * 0.005;
    targetRotX -= dy * 0.005;
    targetRotX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, targetRotX));
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const radius = Math.min(width, height) * 0.38 * currentScale;
    const cx = width / 2;
    const cy = height / 2;

    const filtered = currentGlobeFilter === 'all'
      ? GLOBE_PINS_DATA
      : GLOBE_PINS_DATA.filter(c => c.category === currentGlobeFilter);

    for (let c of filtered) {
      const radLat = c.lat * Math.PI / 180;
      const radLon = c.lon * Math.PI / 180;

      let x = Math.cos(radLat) * Math.sin(radLon + rotY);
      let y = -Math.sin(radLat);
      let z = Math.cos(radLat) * Math.cos(radLon + rotY);

      let y2 = y * Math.cos(rotX) - z * Math.sin(rotX);
      let z2 = y * Math.sin(rotX) + z * Math.cos(rotX);

      if (z2 > 0) {
        const px = cx + x * radius;
        const py = cy + y2 * radius;
        const dist = Math.hypot(mx - px, my - py);
        if (dist < 34) {
          selectCase(c.id);
          return;
        }
      }
    }
  });

  function render() {
    rotX += (targetRotX - rotX) * 0.08;
    rotY += (targetRotY - rotY) * 0.08;
    currentScale += (targetScale - currentScale) * 0.08;

    ctx.clearRect(0, 0, width, height);

    const radius = Math.min(width, height) * 0.38 * currentScale;
    const cx = width / 2;
    const cy = height / 2;

    // Dark base sphere gradient
    const grad = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
    grad.addColorStop(0, '#131926');
    grad.addColorStop(0.7, '#0A0F1A');
    grad.addColorStop(1, '#05070B');

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#286BFF';
    ctx.stroke();

    // Atmosphere halo
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(40, 107, 255, 0.25)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();

    // Meridian & Parallel wireframe
    ctx.strokeStyle = 'rgba(42, 45, 53, 0.45)';
    ctx.lineWidth = 1;
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let first = true;
      for (let lon = 0; lon <= 360; lon += 5) {
        const rLat = lat * Math.PI / 180;
        const rLon = lon * Math.PI / 180;
        let x = Math.cos(rLat) * Math.sin(rLon + rotY);
        let y = -Math.sin(rLat);
        let z = Math.cos(rLat) * Math.cos(rLon + rotY);
        let y2 = y * Math.cos(rotX) - z * Math.sin(rotX);
        let z2 = y * Math.sin(rotX) + z * Math.cos(rotX);
        if (z2 > 0) {
          const px = cx + x * radius;
          const py = cy + y2 * radius;
          if (first) { ctx.moveTo(px, py); first = false; } else { ctx.lineTo(px, py); }
        } else {
          first = true;
        }
      }
      ctx.stroke();
    }

    // Beacons (Tactical holographic laser pillars)
    const filtered = currentGlobeFilter === 'all'
      ? GLOBE_PINS_DATA
      : GLOBE_PINS_DATA.filter(c => c.category === currentGlobeFilter);

    filtered.forEach(c => {
      const rLat = c.lat * Math.PI / 180;
      const rLon = c.lon * Math.PI / 180;
      let x = Math.cos(rLat) * Math.sin(rLon + rotY);
      let y = -Math.sin(rLat);
      let z = Math.cos(rLat) * Math.cos(rLon + rotY);
      let y2 = y * Math.cos(rotX) - z * Math.sin(rotX);
      let z2 = y * Math.sin(rotX) + z * Math.cos(rotX);

      if (z2 > 0) {
        const px = cx + x * radius;
        const py = cy + y2 * radius;

        // Outward surface normal vector for vertical laser beam
        const nx = (px - cx) / radius;
        const ny = (py - cy) / radius;
        const beamLen = 34;
        const bx = px + nx * beamLen;
        const by = py + ny * beamLen;

        ctx.save();

        // 1. Ground contact hotspot & concentric pulse ring
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.strokeStyle = c.color || '#00E5FF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        // 2. Holographic vertical laser beam shooting up into space
        // Outer aura
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(bx, by);
        ctx.lineWidth = 8;
        ctx.strokeStyle = (c.color || '#00E5FF') + '44';
        ctx.stroke();

        // Mid laser beam
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = c.color || '#00E5FF';
        ctx.stroke();

        // Ultra-bright core
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // 3. Orbital beacon head
        ctx.beginPath();
        ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        // 4. Cyber HUD label
        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 3;
        ctx.strokeText(c.label, bx + 6, by + 3);
        ctx.fillText(c.label, bx + 6, by + 3);

        ctx.restore();
      }
    });

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);

  fallbackGlobeInstance = {
    setFilter(type) {
      if (type === 'all') {
        targetRotX = 0.35;
        targetRotY = -0.5;
        targetScale = 1.0;
      } else if (type === 'ice') {
        targetRotX = 28.5 * Math.PI / 180;
        targetRotY = -85 * Math.PI / 180;
        targetScale = 1.35;
      } else if (type === 'volcano') {
        targetRotX = 64 * Math.PI / 180;
        targetRotY = 22 * Math.PI / 180;
        targetScale = 1.45;
      }
    }
  };
}


// ==========================================================================
// 17. COMMAND TOOLBAR MINIMIZATION CONTROLLER
// ==========================================================================
let isToolbarMinimized = false;

function toggleToolbarMinimization() {
  const toolbar = document.getElementById('app-toolbar');
  const restorePill = document.getElementById('toolbar-restore-pill');
  if (!toolbar || !restorePill) return;

  isToolbarMinimized = !isToolbarMinimized;

  if (isToolbarMinimized) {
    toolbar.classList.add('toolbar-minimized');
    restorePill.classList.remove('hidden');
    document.body.classList.add('toolbar-minimized-active');
  } else {
    toolbar.classList.remove('toolbar-minimized');
    restorePill.classList.add('hidden');
    document.body.classList.remove('toolbar-minimized-active');
  }

  setTimeout(() => {
    if (typeof updateConnectingLines === 'function') {
      updateConnectingLines();
    }
  }, 350);
}

window.toggleToolbarMinimization = toggleToolbarMinimization;

// Keyboard shortcut: H key toggles toolbar minimization (HUD mode)
window.addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    toggleToolbarMinimization();
  }
});
