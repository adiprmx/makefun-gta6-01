// Deterministic screenshot scenarios: ?shot=start|play|chase|mission&seed=1.
// Each shot sets up one fixed scene from the seeded world, drives it with a
// scripted autopilot for a fixed number of ticks, then raises
// window.__shotReady so the screenshot script knows the frame is final.

import { WORLD, AVENUES } from './config.js';
import { clamp, angleDiff } from './random.js';

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  return { name: q.get('shot') || '', seed: Number(q.get('seed') || '1') || 1 };
}

function placeOnAvenue(world, x, y, angle, speed) {
  const { state, player } = world;
  const car = state.cars.find((c) => c.kind === 'parked') || state.cars[0];
  car.kind = 'player';
  car.x = x; car.y = y; car.angle = angle; car.speed = speed; car.maxSpeed = 460;
  car.driver = false;
  car.hp = 600; // the hero car takes a beating in a chase
  player.car = car;
  player.onFoot = false;
  player.x = x; player.y = y; player.angle = angle; player.speed = speed;
  state.camera.x = x; state.camera.y = y;
}

function busyStreet(world, avenueX, centerY) {
  // Pull a handful of traffic cars and pedestrians onto the avenues beside
  // the player's, so the frame reads as a living city while the player's
  // own avenue stays clear to drive.
  const { state } = world;
  const lanes = [avenueX - 400, avenueX + 400];
  let placed = 0;
  for (const car of state.cars) {
    if (car.kind !== 'traffic') continue;
    const lane = lanes[placed % 2];
    car.x = lane + (placed % 2 === 0 ? -22 : 22);
    car.y = centerY - 500 + Math.floor(placed / 2) * 260;
    car.angle = placed % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
    car.vertical = true;
    car.speed = 130;
    placed++;
    if (placed >= 8) break;
  }
  let peds = 0;
  for (const ped of state.peds) {
    if (ped.kind !== 'civilian' || ped.down) continue;
    ped.x = avenueX + (peds % 2 === 0 ? -70 : 70);
    ped.y = centerY - 320 + peds * 130;
    ped.angle = peds % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
    peds++;
    if (peds >= 6) break;
  }
}

export function setupShot(world, name) {
  const { state, player, city } = world;
  state.mode = 'playing';
  state.cash = 1250;
  state.health = 100;
  player.ammo = 36;

  if (name === 'start') {
    state.mode = 'title';
    state.time = 0;
    return { ticks: 30, drive: false };
  }
  if (name === 'play') {
    state.missionIndex = 1;
    world.startMission(1);
    placeOnAvenue(world, 1800, 1700, -Math.PI / 2, 300);
    busyStreet(world, 1800, 1400);
    return { ticks: 150, drive: true, avenue: 1800, dir: -Math.PI / 2 };
  }
  if (name === 'chase') {
    state.missionIndex = 2;
    world.startMission(2);
    state.wanted = 3;
    placeOnAvenue(world, 1400, 1900, -Math.PI / 2, 380);
    busyStreet(world, 1400, 1600);
    return { ticks: 180, drive: true, avenue: 1400, dir: -Math.PI / 2 };
  }
  if (name === 'mission') {
    state.missionIndex = 4;
    world.startMission(4);
    player.onFoot = true;
    player.car = null;
    player.x = city.places.bank.x - 120;
    player.y = city.places.bank.y + 40;
    player.angle = 0;
    state.camera.x = player.x; state.camera.y = player.y;
    // A parked getaway car and a few passers-by in frame.
    const car = state.cars.find((c) => c.kind === 'parked');
    if (car) { car.x = player.x + 60; car.y = player.y + 90; car.angle = 0; }
    return { ticks: 90, drive: false };
  }
  return { ticks: 60, drive: false };
}

// Scripted driving: hold the accelerator and steer back onto the avenue.
// Non-driving shots stand still — the autopilot must not walk the player.
export function autopilotInput(world, shot, input) {
  input.up = false;
  input.down = false;
  input.left = false;
  input.right = false;
  input.shoot = false;
  input.punch = false;
  if (!shot.drive || !world.player.car) return;
  input.up = true;
  const car = world.player.car;
  const steer = clamp(angleDiff(car.angle, shot.dir) * 2.2, -1, 1)
    + clamp((shot.avenue - car.x) * 0.004, -0.6, 0.6);
  if (steer < -0.12) input.left = true;
  else if (steer > 0.12) input.right = true;
}
