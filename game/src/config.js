// Costa Verde — tuning, palette and story data for the open-world game.
// Every number that shapes how the city feels lives here, so the rest of the
// code reads like rules instead of magic constants.

export const WORLD = { w: 3600, h: 2800 };
export const ROAD_W = 96;
export const BLOCK = 400;

// Avenues (vertical roads) and streets (horizontal roads), centre coordinates.
export const AVENUES = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400];
export const STREETS = [200, 600, 1000, 1400, 1800, 2200, 2600];

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  sand: '#e8d29a',
  water: '#2e7f9e',
  waterDeep: '#256b87',
  road: '#3c3f46',
  roadEdge: '#2e3138',
  lane: '#e8d44f',
  sidewalk: '#b9b3a4',
  buildingRoof: ['#c96f4a', '#d98a5f', '#8a6f9e', '#5f8a7a', '#b5503f', '#e0a458'],
  buildingWall: ['#e8dcc8', '#d9c8a8', '#cbb59a', '#f0e6d2'],
  park: '#5d9b4a',
  tree: '#3f7d33',
  treeLight: '#57a047',
  car: ['#d94f3d', '#3d7dd9', '#e8c33d', '#7ad93d', '#d93d9e', '#e8e8e8', '#2e2e34', '#e08a3d'],
  police: '#2b4fd9',
  taxi: '#f2c200',
  hud: '#f5eeda',
  gold: '#f2c200',
};

export const DISTRICTS = [
  { name: 'Old Town', x0: 0, y0: 0, x1: 1200, y1: 1200, style: 'old' },
  { name: 'Downtown', x0: 1200, y0: 0, x1: 2400, y1: 1400, style: 'downtown' },
  { name: 'The Hills', x0: 0, y0: 1200, x1: 1200, y1: 2800, style: 'hills' },
  { name: 'Portside', x0: 2400, y0: 0, x1: 3600, y1: 1400, style: 'port' },
  { name: 'Marina Bay', x0: 1200, y0: 1400, x1: 3600, y1: 2800, style: 'marina' },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  return DISTRICTS[0];
}

// Story: Marco Solis, a driver for hire in Costa Verde, owes Mama Rosa.
// Five missions, each with a briefing, an objective and a cash reward.
export const MISSIONS = [
  {
    id: 1, name: 'First Wheels',
    brief: "Mama Rosa needs a driver. Any car will do — hers is in the shop. Grab one and bring it to the garage.",
    objective: 'Steal a car and drive to the garage',
    reward: 150,
    kind: 'driveTo', target: { x: 600, y: 1400, label: "Rosa's Garage" },
    needCar: true,
  },
  {
    id: 2, name: 'The Pickup',
    brief: "A package is waiting at the Portside docks. Park up, walk in and collect it. No questions, no trouble.",
    objective: 'Collect the package at the docks',
    reward: 250,
    kind: 'walkTo', target: { x: 3000, y: 600, label: 'Portside Docks' },
    needCar: false,
  },
  {
    id: 3, name: 'Hot Delivery',
    brief: "That package has to reach the Marina in 90 seconds. The cops are already sniffing around — drive fast, drive clean.",
    objective: 'Deliver the package to the Marina (90s)',
    reward: 400,
    kind: 'timedDrive', target: { x: 2200, y: 2200, label: 'Marina Drop' },
    timeLimit: 90, needCar: true, wantedOnStart: 1,
  },
  {
    id: 4, name: 'Cool Down',
    brief: "Too hot. Lose the heat, then lay low at the hideout until the streets forget your face.",
    objective: 'Lose the wanted level, then reach the hideout',
    reward: 300,
    kind: 'loseHeat', target: { x: 1000, y: 2200, label: 'Hideout' },
    needCar: false,
  },
  {
    id: 5, name: 'The Big Score',
    brief: "One last job: the vault cash at Costa Verde Trust. Walk in, take it, and outrun the whole city. Make Mama Rosa proud.",
    objective: 'Grab the cash, escape the cops, reach the hideout',
    reward: 1500,
    kind: 'heist', target: { x: 1800, y: 600, label: 'Costa Verde Trust' },
    needCar: false,
  },
];

export const TUNING = {
  playerWalkSpeed: 200,
  playerRunSpeed: 260,
  carAccel: 520,
  carMaxSpeed: 460,
  carReverseMax: 180,
  carTurn: 2.6,
  carGrip: 0.92,
  trafficSpeed: 130,
  pedSpeed: 55,
  policeSpeed: 500,
  policeRamDamage: 8,
  punchDamage: 15,
  pistolDamage: 34,
  pistolAmmoStart: 36,
  maxHealth: 100,
  maxWanted: 5,
  wantedDecayMs: 9000,
  bustedFine: 200,
  wastedFine: 150,
  saveKey: 'costaverde-save-v1',
};
