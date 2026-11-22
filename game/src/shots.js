// Deterministic screenshot scenarios for Costa Verde. Each shot sets the world
// to an exact state, drives it with a fixed input script for a fixed number of
// frames, and then the page flags window.__shotReady. Same seed, same pixels.
import { MISSIONS } from './config.js';
import { angleDelta, clamp } from './random.js';

function installDriver(input, fn) {
  input.driveAxes = () => {
    const a = fn();
    return { steer: a.steer || 0, throttle: a.throttle || 0 };
  };
  input.walkAxes = () => {
    const a = fn();
    return { x: a.walkX || 0, y: a.walkY || 0 };
  };
  input.wasPressed = () => false;
  input.consume = () => false;
  input.consumeClick = () => false;
  input.down = () => false;
}

// Steer a car along one avenue: aim at the travel direction, corrected by how
// far the car has drifted off the avenue's centreline.
function driveOnAvenue(world, avenueX, dir) {
  const car = world.player.inCar;
  if (!car) return { steer: 0, throttle: 0 };
  const targetAngle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  const lateral = car.x - avenueX;
  const want = targetAngle + dir * clamp(lateral * 0.004, -0.5, 0.5);
  const steer = clamp(angleDelta(car.angle, want) * 2.2, -1, 1);
  return { steer, throttle: 1 };
}

function makeHeroCar(x, y, angle, speed, color) {
  return {
    x, y, angle, speed, hp: 600, kind: 'hero', color,
    driven: true, axis: 'y', dir: 1, lane: 18, turnAt: 0, stuck: 0, touchTimer: 0,
  };
}

export function setupShot(world, input, name) {
  world.shot = name;
  const p = world.player;

  if (name === 'start') {
    world.state = 'title';
    return { frames: 150 };
  }

  world.state = 'playing';
  world.toasts.length = 0;

  if (name === 'play') {
    world.missionIndex = 1;
    world.mission = MISSIONS[1];
    world.missionTimer = 0;
    world.missionPhase = 0;
    world.missionDone = false;
    const car = makeHeroCar(1500, 900, Math.PI / 2, 320, '#f2f2f2');
    world.cars.push(car);
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.cash = 1292;
    world.camera.x = car.x;
    world.camera.y = car.y;
    installDriver(input, () => driveOnAvenue(world, 1500, 1));
    return { frames: 100 };
  }

  if (name === 'chase') {
    world.missionIndex = 2;
    world.mission = MISSIONS[2];
    world.missionTimer = 88;
    world.missionPhase = 0;
    world.missionDone = false;
    world.wanted = 3;
    world.wantedTimer = 0;
    const car = makeHeroCar(2100, 1900, -Math.PI / 2, 380, '#f2f2f2');
    world.cars.push(car);
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.cash = 1840;
    const cop1 = makeHeroCar(2060, 2160, -Math.PI / 2, 340, '#2e5fd8');
    cop1.kind = 'police';
    cop1.hp = 500;
    const cop2 = makeHeroCar(2140, 2260, -Math.PI / 2, 330, '#2e5fd8');
    cop2.kind = 'police';
    cop2.hp = 500;
    world.cars.push(cop1, cop2);
    world.camera.x = car.x;
    world.camera.y = car.y;
    installDriver(input, () => driveOnAvenue(world, 2100, -1));
    return { frames: 100 };
  }

  if (name === 'mission') {
    world.missionIndex = 4;
    world.mission = MISSIONS[4];
    world.missionTimer = 0;
    world.missionPhase = 0;
    world.missionDone = false;
    world.wanted = 0;
    p.inCar = null;
    p.x = 2850;
    p.y = 1830;
    p.angle = Math.PI / 2;
    p.hp = 100;
    p.ammo = 36;
    p.cash = 2100;
    world.camera.x = p.x;
    world.camera.y = p.y;
    installDriver(input, () => ({ steer: 0, throttle: 0, walkX: 0, walkY: 0 }));
    return { frames: 150 };
  }

  // Unknown shot: just show the title screen.
  world.state = 'title';
  return { frames: 120 };
}
