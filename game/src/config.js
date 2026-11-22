// Tuning and story data for Costa Verde. Nothing here names a real place or a
// commercial game: the city, its districts, its people and its jobs are invented.
export const CITY = {
  width: 3600,
  height: 2800,
  // Avenues (vertical roads) and streets (horizontal roads), centre lines.
  avenues: [300, 900, 1500, 2100, 2700, 3300],
  streets: [300, 800, 1300, 1800, 2300],
  roadWidth: 120,
  // The bay along the south edge: water, not walkable.
  bayTop: 2620,
};

export const DISTRICTS = [
  { name: 'Old Town', x0: 0, y0: 0, x1: 1200, y1: 1000, ground: '#c9b183', roof: '#8a6f4d', accent: '#b5522e' },
  { name: 'Downtown', x0: 1200, y0: 0, x1: 2400, y1: 1500, ground: '#9aa5ad', roof: '#5d6b78', accent: '#2e7fb5' },
  { name: 'The Hills', x0: 2400, y0: 0, x1: 3600, y1: 1000, ground: '#a8bf8e', roof: '#7d8f6a', accent: '#c9a227' },
  { name: 'Portside', x0: 0, y0: 1000, x1: 1200, y1: 2620, ground: '#b0a58f', roof: '#6e6258', accent: '#c96a1e' },
  { name: 'Marina Bay', x0: 1200, y0: 1500, x1: 3600, y1: 2620, ground: '#a3c4c9', roof: '#4d7d8a', accent: '#e0a32e' },
];

export const PLAYER = {
  radius: 13,
  walkSpeed: 230,
  accel: 1800,
  health: 100,
  punchDamage: 25,
  punchRange: 34,
  punchArc: 1.1,
  gunDamage: 34,
  gunRange: 460,
  startAmmo: 24,
  startCash: 120,
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 160,
  steerRate: 2.6,
  grip: 6.0,
  heroHp: 600,
  trafficHp: 220,
  policeHp: 500,
};

export const WANTED = {
  // Seconds without a crime before one star fades.
  decaySeconds: 26,
  // Extra decay while no cop can see the player (laying low).
  hiddenDecaySeconds: 12,
  maxStars: 5,
  // Police cars on the hunt per star level.
  policeCars: [0, 1, 2, 2, 3, 4],
  // Foot cops on the hunt per star level.
  footCops: [0, 0, 1, 2, 2, 3],
};

export const MISSIONS = [
  {
    id: 1,
    name: 'First Wheels',
    giver: 'Mama Rosa',
    briefing: 'Marco, you need wheels before anything else. That blue coupe parked by the Old Town market is unlocked. Take it.',
    target: { x: 830, y: 620, label: 'Steal the blue coupe' },
    reward: 150,
    hint: 'Walk up to the car and press E to get in.',
  },
  {
    id: 2,
    name: 'The Pickup',
    giver: 'Mama Rosa',
    briefing: 'A package is waiting behind the Downtown arcade. Bring it to me, no questions, no cops.',
    target: { x: 1500, y: 1050, label: 'Pick up the package' },
    reward: 300,
    hint: 'Drive or walk to the gold star. Stealing a car raises your wanted level.',
  },
  {
    id: 3,
    name: 'Hot Delivery',
    giver: 'Mama Rosa',
    briefing: 'The package has to reach Portside in 90 seconds or the deal is dead. Drive like the bay is on fire.',
    target: { x: 300, y: 2050, label: 'Deliver the package' },
    reward: 500,
    timer: 90,
    hint: 'You have 90 seconds. Stick to the avenues and do not stop for anyone.',
  },
  {
    id: 4,
    name: 'Cool Down',
    giver: 'Mama Rosa',
    briefing: 'The heat is on you, Marco. Lay low until the stars are gone. Stay out of sight and keep your nose clean.',
    target: { x: 1500, y: 1300, label: 'Lose the wanted level' },
    reward: 200,
    hint: 'Wanted stars fade when no cop can see you. Hide between buildings.',
  },
  {
    id: 5,
    name: 'The Big Score',
    giver: 'Mama Rosa',
    briefing: 'Costa Verde Trust keeps its vault behind the Marina Bay branch. Walk in, hold E at the counter, then run for the orange getaway car.',
    target: { x: 2850, y: 1800, label: 'Rob Costa Verde Trust' },
    reward: 2500,
    hint: 'Press E at the bank counter to start the robbery, then reach the orange car.',
  },
];

export const PICKUPS = [
  { kind: 'cash', color: '#37c978', label: '$' },
  { kind: 'health', color: '#ff5d5d', label: '+' },
  { kind: 'ammo', color: '#f2c230', label: 'A' },
];

export const SAVE_KEY = 'costa-verde-save-v1';
