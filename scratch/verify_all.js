const fs = require('fs');

console.log('=== VERIFYING NISAR REPO INTEGRITY (v53) ===');

let pass = true;

// 1. Check cases.json
try {
  const casesRaw = fs.readFileSync('data/cases.json', 'utf8');
  const casesData = JSON.parse(casesRaw);
  console.log(`✓ cases.json parsed successfully. Build ID: ${casesData.build_id}, Total cases: ${casesData.cases.length}`);
  if (casesData.build_id !== '20261107_v53') {
    console.error(`✗ Expected build_id 20261107_v53, got ${casesData.build_id}`);
    pass = false;
  }
  const langtang = casesData.cases.find(c => c.id === 'langtang');
  const suicide = casesData.cases.find(c => c.id === 'suicide_basin');
  if (langtang && langtang.pre_date === '2026-08-19' && langtang.post_date === '2026-08-31') {
    console.log('✓ Langtang updated to verified dates (Aug 19 -> Aug 31)');
  } else {
    console.error('✗ Langtang dates verification failed');
    pass = false;
  }
  if (suicide && suicide.pre_date === '2026-08-11' && suicide.post_date === '2026-08-23') {
    console.log('✓ Suicide Basin updated to verified dates (Aug 11 -> Aug 23)');
  } else {
    console.error('✗ Suicide Basin dates verification failed');
    pass = false;
  }
  if (langtang.radar_pairs && suicide.radar_pairs) {
    console.log('✓ Both cases contain verified radar_pairs matrix');
  } else {
    console.error('✗ radar_pairs missing in cases.json');
    pass = false;
  }
} catch (e) {
  console.error('✗ cases.json error:', e.message);
  pass = false;
}

// 2. Check CSS brace balance & starfield png reference
try {
  const css = fs.readFileSync('style.css', 'utf8');
  let openCount = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') openCount++;
    if (css[i] === '}') openCount--;
  }
  console.log(`✓ style.css brace delta: ${openCount} (0 means perfectly balanced)`);
  if (openCount !== 0) {
    console.error('✗ UNBALANCED BRACES IN style.css!');
    pass = false;
  }
  if (css.includes('radar-pairs-card')) {
    console.log('✓ style.css contains .radar-pairs-card styling');
  } else {
    console.error('✗ .radar-pairs-card missing from style.css');
    pass = false;
  }
  if (css.includes('.command-toolbar.vertical-toolbar .toolbar-context-panel')) {
    console.log('✓ style.css contains .toolbar-context-panel styling');
  } else {
    console.error('✗ .toolbar-context-panel missing from style.css');
    pass = false;
  }
} catch (e) {
  console.error('✗ style.css error:', e.message);
  pass = false;
}

// 3. Check assets/globe_starfield_bg.png
try {
  if (fs.existsSync('assets/globe_starfield_bg.png')) {
    const stat = fs.statSync('assets/globe_starfield_bg.png');
    console.log(`✓ assets/globe_starfield_bg.png exists (${stat.size} bytes)`);
  } else {
    console.error('✗ assets/globe_starfield_bg.png not found on disk!');
    pass = false;
  }
} catch (e) {
  console.error('✗ Asset check error:', e.message);
  pass = false;
}

// 4. Check notebooks & pipeline scripts
try {
  const nb2 = JSON.parse(fs.readFileSync('stage1_2.ipynb', 'utf8'));
  console.log(`✓ stage1_2.ipynb cells: ${nb2.cells.length}`);
  if (nb2.cells.length !== 27) {
    console.error('✗ Expected 27 cells in stage1_2.ipynb');
    pass = false;
  }
  if (fs.existsSync('pipeline_stage1_2.py')) {
    console.log('✓ pipeline_stage1_2.py exists on disk');
  } else {
    console.error('✗ pipeline_stage1_2.py not found');
    pass = false;
  }
} catch (e) {
  console.error('✗ Notebook check error:', e.message);
  pass = false;
}

// 5. Check index.html
try {
  const html = fs.readFileSync('index.html', 'utf8');
  const cssMatch = html.match(/style\.css\?v=([a-zA-Z0-9_]+)/);
  const jsMatch = html.match(/app\.js\?v=([a-zA-Z0-9_]+)/);
  console.log('✓ index.html style.css version:', cssMatch ? cssMatch[1] : 'NOT FOUND');
  console.log('✓ index.html app.js version:', jsMatch ? jsMatch[1] : 'NOT FOUND');

  if (cssMatch && cssMatch[1] !== '20261107_v53') {
    console.error('✗ style.css query version not 20261107_v53');
    pass = false;
  }
  if (jsMatch && jsMatch[1] !== '20261107_v53') {
    console.error('✗ app.js query version not 20261107_v53');
    pass = false;
  }

  const requiredIds = [
    'dashboard-view', 'isometric-viewport', 'dashboard-laser-svg', 'laser-paths-group',
    'core-globe-container', 'core-globe',
    'node-langtang', 'node-suicide', 'node-chamoli', 'node-lhonak',
    'diorama-langtang', 'diorama-suicide', 'diorama-chamoli', 'diorama-lhonak',
    'story-card-modal', 'modal-story-title',
    'nav-btn-dashboard', 'nav-btn-globe', 'place-view', 'place-map', 'story-view',
    'globe-view', 'cesiumContainer', 'radar-pairs-card', 'gcov-before-dates', 'pair-btn-spans',
    'toolbar-landing-context', 'toolbar-dashboard-filters', 'toolbar-globe-context',
    'toolbar-place-context', 'toolbar-story-context'
  ];
  const missing = requiredIds.filter(id => !html.includes(`id="${id}"`));
  if (missing.length === 0) {
    console.log('✓ All critical Dashboard, Globe, Place, Contextual Toolbar & Radar Pair DOM IDs present in index.html');
  } else {
    console.error('✗ Missing DOM IDs:', missing);
    pass = false;
  }
} catch (e) {
  console.error('✗ index.html error:', e.message);
  pass = false;
}

// 6. Check app.js syntax & core functions
try {
  const js = fs.readFileSync('app.js', 'utf8');
  new Function(js);
  console.log('✓ app.js syntax is valid (executed via Function constructor)');

  const funcsToCheck = [
    'setupSwipeControl',
    'renderStoryScreen',
    'initCesiumGlobe',
    'applyGlobeFilter',
    'renderPlaceScreen',
    'openStoryGuide',
    'goToNextCase',
    'setSignalLayer',
    'toggleSidebar',
    'initStoryMiniMap',
    'initCoreGlobe',
    'updateConnectingLines',
    'filterDashboardNodes',
    'setupNodeLaserHoverListeners',
    'toggleAdvancedDiagnostics',
    'selectRadarPair',
    'updateToolbarContext',
    'handleGlobeBeaconClick'
  ];
  const missingFuncs = funcsToCheck.filter(fn => !js.includes('function ' + fn));
  if (missingFuncs.length === 0) {
    console.log(`✓ All ${funcsToCheck.length} core application functions verified in app.js`);
  } else {
    console.error('✗ Missing functions in app.js:', missingFuncs);
    pass = false;
  }
} catch (e) {
  console.error('✗ app.js error:', e.message);
  pass = false;
}

console.log(pass ? '\n>>> ALL CHECKS PASSED SUCCESSFULLY <<<' : '\n>>> VERIFICATION FAILED <<<');
process.exit(pass ? 0 : 1);
