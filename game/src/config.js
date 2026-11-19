// Sunport Heat — shared tuning, palette and city constants.
// Every number that shapes how the game feels lives here so the rest of
// the code can stay about behaviour, not magic numbers.

export const WORLD = {
  size: 3600, // the city is a square, WORLD.size x WORLD.size world units
  roadEvery: 400, // distance between road centre lines
  roadWidth: 72,
  sidewalk: 14,
  block: 328, // 400 - 72, the buildable square between roads
};

export const CITY = {
  name: 'Sunport',
  // District bands, read as rows/columns of blocks (0..8). Each block gets
  // a district by its column and row; districts only change the look of the
  // buildings and the props that spawn there.
  districts: [
    { name: 'Palmside', row: [0, 1], col: [0, 1], style: 'houses' },
    { name: 'Old Town', row: [0, 2], col: [2, 4], style: 'brick' },
    { name: 'Downtown', row: [2, 4], col: [3, 5], style: 'towers' },
    { name: 'The Docks', row: [6, 8], col: [0, 2], style: 'industrial' },
    { name: 'Marina Bay', row: [6, 8], col: [6, 8], style: 'marina' },
    { name: 'Eastside', row: [3, 5], col: [6, 8], style: 'houses' },
    { name: 'North Hills', row: [0, 1], col: [5, 8], style: 'houses' },
  ],
};

// Warm late-afternoon palette: sun-soaked concrete, coral and teal.
export const PALETTE = {
  grass: '#7fae62',
  grassDark: '#6f9d55',
  park: '#5d9448',
  sand: '#e8d5a4',
  water: '#2e7f9e',
  waterDeep: '#256b87',
  road: '#3a3a40',
  roadEdge: '#2c2c31',
  lane: '#e8d44f',
  sidewalk: '#9a9a92',
  curb: '#7d7d76',
  crosswalk: '#d8d8ce',
  buildingRoof: ['#c96f4a', '#d99a5b', '#b85c5c', '#7d9bb5', '#a8b06a', '#8f7fb5'],
  buildingWall: ['#e8dcc8', '#e0c9a8', '#d9b8a0', '#c8d4dc', '#e6d5b8'],
  towerGlass: ['#5f88a8', '#6f9ab5', '#4f7d99'],
  tree: '#3f7a34',
  treeDark: '#356b2c',
  player: '#e8b13c',
  police: '#2b5fb5',
  policeLight: '#ff2e2e',
  taxi: '#f2c230',
  hud: '#101014',
};

export const PLAYER = {
  radius: 15,
  walkSpeed: 165,
  runSpeed: 235,
  health: 100,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.45,
  gunDamage: 26,
  gunCooldown: 0.28,
  gunRange: 420,
  startCash: 120,
  startX: 600,
  startY: 400,
};

export const CAR = {
  length: 46,
  width: 22,
  radius: 17,
  accel: 340,
  brake: 520,
  reverseAccel: 220,
  maxSpeed: 460,
  maxReverse: 160,
  grip: 2.6,
  drag: 0.08, // per-frame drag rate; top speed is enforced by each model's `top` clamp
  steerMax: 0.62,
  // Models the player can steal or be given. Top speed and handling differ.
  models: [
    { key: 'sedan', name: 'Civic', top: 380, accel: 300, color: '#b8bcc4' },
    { key: 'taxi', name: 'Sun Cab', top: 360, accel: 290, color: '#f2c230' },
    { key: 'sport', name: 'Comet GT', top: 520, accel: 420, color: '#c22e3d' },
    { key: 'van', name: 'Box Van', top: 300, accel: 230, color: '#e8e4da' },
    { key: 'muscle', name: 'V8 Brute', top: 470, accel: 380, color: '#2e5d8a' },
    { key: 'police', name: 'SPPD Cruiser', top: 490, accel: 400, color: '#2b5fb5' },
    { key: 'armored', name: 'Bullion Van', top: 330, accel: 260, color: '#5a6b52' },
  ],
};

export const TRAFFIC = {
  count: 26,
  minSpeed: 90,
  maxSpeed: 150,
  pedCount: 34,
  pedSpeed: 42,
};

export const WANTED = {
  maxStars: 5,
  heatPerStar: 20,
  decayDelay: 12, // seconds with no police near and no crime before heat falls
  decayRate: 5, // heat per second while hidden
  crimeHeat: { steal: 22, hitPed: 24, shoot: 21, assaultCop: 30, crash: 4 },
  // How many police cars hunt the player at each star level.
  carsForStars: [0, 1, 2, 2, 3, 4],
  footForStars: [0, 0, 1, 2, 3, 4],
  copSpeed: 250,
  copRamDamage: 9,
};

export const MISSIONS = {
  debt: 50000, // what Rex owes Mara Quinn; the story ends when it is paid
  taxiFareMin: 90,
  taxiFareMax: 320,
};

export const CAMERA = {
  zoomFoot: 1.08,
  zoomCar: 0.72,
  follow: 6.5, // smoothing; higher is snappier
};

export const SAVE_KEY = 'sunport-heat-save-v1';
