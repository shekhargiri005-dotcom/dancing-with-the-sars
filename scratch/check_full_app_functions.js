const fs = require('fs');
const js = fs.readFileSync('app.js', 'utf8');

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

let allOk = true;
funcsToCheck.forEach(fn => {
  const isPresent = js.includes('function ' + fn);
  console.log(`[CHECK] ${fn.padEnd(30)}: ${isPresent ? '✓ DEFINED' : '✗ MISSING'}`);
  if (!isPresent) allOk = false;
});

console.log('Result:', allOk ? 'ALL FUNCTIONS VERIFIED' : 'SOME MISSING');
process.exit(allOk ? 0 : 1);
