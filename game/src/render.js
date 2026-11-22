// Everything the player sees: the sun-soaked city, cars, people, the HUD
// with its minimap, and the title, pause, busted, wasted and win screens.
// All drawing is flat canvas shapes — the game's whole art direction.

import { WORLD, ROAD_W, AVENUES, STREETS, PALETTE, TUNING, districtAt } from './config.js';
import { clamp } from './random.js';

const VIEW_W = 1280, VIEW_H = 800;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, x, y, angle, color, kind, sirenOn, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -19, -9, 40, 22, 6);
  ctx.fill();
  // Body.
  ctx.fillStyle = color;
  roundRect(ctx, -20, -11, 40, 22, 7);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  roundRect(ctx, -6, -9, 14, 18, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,240,0.7)';
  roundRect(ctx, 4, -8, 5, 16, 2);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#1c1c22';
  ctx.fillRect(-14, -13, 8, 4);
  ctx.fillRect(-14, 9, 8, 4);
  ctx.fillRect(8, -13, 8, 4);
  ctx.fillRect(8, 9, 8, 4);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(19, -8, 2, 4);
  ctx.fillRect(19, 4, 2, 4);
  if (kind === 'police') {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-2, -11, 6, 22);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CVPD', 1, 3);
    if (sirenOn) {
      const red = Math.floor(time * 2.4) % 2 === 0;
      ctx.fillStyle = red ? '#ff2e2e' : '#2e6bff';
      ctx.beginPath(); ctx.arc(-8, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = red ? '#2e6bff' : '#ff2e2e';
      ctx.beginPath(); ctx.arc(8, 0, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (kind === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  ctx.restore();
}

function drawPed(ctx, x, y, angle, color, kind, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9a06a';
    ctx.beginPath(); ctx.arc(13, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 2, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d9a06a';
  ctx.beginPath(); ctx.arc(10, 0, 5, 0, Math.PI * 2); ctx.fill();
  if (kind === 'cop') {
    ctx.fillStyle = '#1c2f6e';
    ctx.beginPath(); ctx.arc(10, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c200';
    ctx.fillRect(4, -5, 3, 10);
  }
  ctx.restore();
}

export function drawWorld(ctx, world) {
  const { state, city, player } = world;
  const cam = state.camera;
  const shakeX = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  const shakeY = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  const ox = VIEW_W / 2 - cam.x + shakeX;
  const oy = VIEW_H / 2 - cam.y + shakeY;

  ctx.fillStyle = '#e8c98a';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.save();
  ctx.translate(ox, oy);

  // Ground.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(-100, -100, WORLD.w + 200, WORLD.h + 200);
  // Subtle grass patches.
  ctx.fillStyle = PALETTE.grassDark;
  for (let i = 0; i < 60; i++) {
    const gx = ((i * 613) % WORLD.w) - 100;
    const gy = ((i * 977) % WORLD.h) - 100;
    ctx.fillRect(gx, gy, 90, 60);
  }
  // Bay + beach along the south edge.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(-100, city.bayTop - 46, WORLD.w + 200, 46);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(-100, city.bayTop, WORLD.w + 200, WORLD.h - city.bayTop + 100);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let i = 0; i < 24; i++) {
    ctx.fillRect(((i * 331) % WORLD.w) - 100, city.bayTop + 30 + ((i * 57) % 90), 120, 6);
  }

  // Parks.
  for (const p of city.parks) {
    ctx.fillStyle = PALETTE.park;
    roundRect(ctx, p.x, p.y, p.w, p.h, 12);
    ctx.fill();
  }

  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, -100, ROAD_W, WORLD.h + 200);
  for (const sy of STREETS) ctx.fillRect(-100, sy - ROAD_W / 2, WORLD.w + 200, ROAD_W);
  // Lane dashes.
  ctx.fillStyle = PALETTE.lane;
  for (const ax of AVENUES) {
    for (let y = 0; y < WORLD.h; y += 64) ctx.fillRect(ax - 2, y, 4, 30);
  }
  for (const sy of STREETS) {
    for (let x = 0; x < WORLD.w; x += 64) ctx.fillRect(x, sy - 2, 30, 4);
  }
  // Sidewalks.
  ctx.strokeStyle = PALETTE.sidewalk;
  ctx.lineWidth = 10;
  for (const ax of AVENUES) {
    ctx.beginPath(); ctx.moveTo(ax - ROAD_W / 2 - 5, 0); ctx.lineTo(ax - ROAD_W / 2 - 5, WORLD.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax + ROAD_W / 2 + 5, 0); ctx.lineTo(ax + ROAD_W / 2 + 5, WORLD.h); ctx.stroke();
  }
  for (const sy of STREETS) {
    ctx.beginPath(); ctx.moveTo(0, sy - ROAD_W / 2 - 5); ctx.lineTo(WORLD.w, sy - ROAD_W / 2 - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, sy + ROAD_W / 2 + 5); ctx.lineTo(WORLD.w, sy + ROAD_W / 2 + 5); ctx.stroke();
  }

  // Buildings with a soft shadow and lit windows.
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,240,180,0.85)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if ((c * 7 + r * 11 + b.floors) % 3 === 0) {
          ctx.fillRect(b.x + 12 + c * 34, b.y + 12 + r * 34, 12, 14);
        }
      }
    }
    if (b.floors >= 4) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${b.floors}F`, b.x + 8, b.y + 16);
    }
  }

  // Trees.
  for (const t of city.trees) {
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(t.x - 2, t.y - 2, 4, 6);
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath(); ctx.arc(t.x, t.y - 4, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.treeLight;
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 7, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }

  // Mission target marker (pulsing).
  if (state.mission && !state.mission.done && state.mode === 'playing') {
    const t = state.mission.target;
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#f2c200';
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', 0, 1);
    ctx.restore();
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(t.label, t.x, t.y - 44);
    ctx.fillStyle = '#fff';
    ctx.fillText(t.label, t.x, t.y - 44);
  }

  // Pickups.
  for (const pk of state.pickups) {
    const bob = Math.sin(pk.bob) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.fillStyle = pk.kind === 'cash' ? '#f2c200' : pk.kind === 'health' ? '#ff5a5a' : '#7ad9ff';
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : 'A', 0, 1);
    ctx.restore();
  }

  // Cars (traffic, parked, police, player).
  for (const car of state.cars) {
    drawCar(ctx, car.x, car.y, car.angle, car.color, car.kind === 'police' ? 'police' : 'car', car.siren && state.wanted > 0, state.time);
  }
  // Player on foot.
  if (player.onFoot) {
    drawPed(ctx, player.x, player.y, player.angle, '#3d7dd9', 'player', false);
    // Direction tick.
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(player.angle) * 14, player.y + Math.sin(player.angle) * 14);
    ctx.lineTo(player.x + Math.cos(player.angle) * 24, player.y + Math.sin(player.angle) * 24);
    ctx.stroke();
  }
  // Pedestrians.
  for (const ped of state.peds) {
    drawPed(ctx, ped.x, ped.y, ped.angle, ped.color, ped.kind, ped.down);
  }
  // Bullets.
  ctx.fillStyle = '#ffe9a8';
  for (const b of state.bullets) {
    ctx.fillRect(b.x - 3, b.y - 3, 6, 6);
  }
  // Particles.
  for (const p of state.particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // Edge arrow pointing at the mission target when it is off-screen.
  if (state.mission && !state.mission.done && state.mode === 'playing') {
    const t = state.mission.target;
    const sx = t.x - cam.x + VIEW_W / 2;
    const sy = t.y - cam.y + VIEW_H / 2;
    if (sx < 60 || sx > VIEW_W - 60 || sy < 60 || sy > VIEW_H - 60) {
      const a = Math.atan2(sy - VIEW_H / 2, sx - VIEW_W / 2);
      const ax = VIEW_W / 2 + Math.cos(a) * 300;
      const ay = VIEW_H / 2 + Math.sin(a) * 240;
      const d = Math.round(Math.hypot(t.x - player.x, t.y - player.y));
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a);
      ctx.fillStyle = '#f2c200';
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#f2c200';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${t.label} · ${d}m`, ax, ay + 30);
    }
  }
}

export function drawMinimap(ctx, world) {
  const { state, city, player } = world;
  const mw = 210, mh = 164, mx = 16, my = VIEW_H - mh - 16;
  const scale = Math.min(mw / WORLD.w, mh / WORLD.h);
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 10);
  ctx.fill();
  ctx.strokeStyle = '#f2c200';
  ctx.lineWidth = 2;
  roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 10);
  ctx.stroke();
  ctx.beginPath();
  roundRect(ctx, mx, my, mw, mh, 6);
  ctx.clip();
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#2e7f9e';
  ctx.fillRect(mx, my + (city.bayTop * scale), mw, mh);
  ctx.fillStyle = '#3c3f46';
  for (const ax of AVENUES) ctx.fillRect(mx + ax * scale - 1.5, my, 3, mh);
  for (const sy of STREETS) ctx.fillRect(mx, my + sy * scale - 1.5, mw, 3);
  // Mission target.
  if (state.mission && !state.mission.done) {
    const t = state.mission.target;
    ctx.fillStyle = '#f2c200';
    ctx.beginPath(); ctx.arc(mx + t.x * scale, my + t.y * scale, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#4d7dff';
  for (const car of state.cars) {
    if (car.kind === 'police') {
      ctx.beginPath(); ctx.arc(mx + car.x * scale, my + car.y * scale, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Player arrow.
  ctx.save();
  ctx.translate(mx + player.x * scale, my + player.y * scale);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#f5eeda';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(districtAt(player.x, player.y).name.toUpperCase(), mx, my - 12);
}

export function drawHUD(ctx, world, input) {
  const { state, player } = world;
  ctx.textBaseline = 'alphabetic';
  // Cash + health, top left.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, 14, 14, 220, 62, 10);
  ctx.fill();
  ctx.fillStyle = '#f2c200';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${state.cash}`, 26, 42);
  ctx.fillStyle = '#2b2b2b';
  roundRect(ctx, 26, 50, 150, 12, 6);
  ctx.fill();
  ctx.fillStyle = state.health > 30 ? '#5ad95a' : '#ff5a5a';
  roundRect(ctx, 26, 50, 150 * clamp(state.health / TUNING.maxHealth, 0, 1), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#f5eeda';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('HEALTH', 182, 60);
  // Wanted stars, top right.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, VIEW_W - 220, 14, 206, 48, 10);
  ctx.fill();
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < TUNING.maxWanted; i++) {
    ctx.fillStyle = i < state.wanted ? '#ffcf3d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', VIEW_W - 208 + i * 40, 48);
  }
  // Mission objective, top centre.
  if (state.mission && !state.mission.done) {
    const m = state.mission;
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    const text = `${m.def.id}. ${m.def.name} — ${m.def.objective}`;
    ctx.font = 'bold 15px sans-serif';
    const w = Math.min(ctx.measureText(text).width + 28, VIEW_W - 480);
    roundRect(ctx, VIEW_W / 2 - w / 2, 14, w, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#f2c200';
    ctx.textAlign = 'center';
    ctx.fillText(text, VIEW_W / 2, 39);
    if (m.def.timeLimit) {
      ctx.fillStyle = m.timer < 20 ? '#ff5a5a' : '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`${Math.ceil(m.timer)}s`, VIEW_W / 2, 72);
    }
  }
  // Speedometer while driving.
  if (!player.onFoot && player.car) {
    const kmh = Math.round(Math.abs(player.car.speed) * 0.9);
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(ctx, VIEW_W - 150, VIEW_H - 84, 134, 68, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${kmh}`, VIEW_W - 52, VIEW_H - 34);
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#f2c200';
    ctx.fillText('km/h', VIEW_W - 26, VIEW_H - 34);
  }
  // Weapon + ammo, bottom right above the speedometer.
  if (player.onFoot) {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(ctx, VIEW_W - 150, VIEW_H - 84, 134, 68, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(player.weapon === 'pistol' ? 'PISTOL' : 'FISTS', VIEW_W - 138, VIEW_H - 52);
    ctx.fillStyle = '#f2c200';
    ctx.fillText(`AMMO ${player.ammo}`, VIEW_W - 138, VIEW_H - 30);
    // Crosshair at the mouse.
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(input.mouseScreenX, input.mouseScreenY, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(input.mouseScreenX - 13, input.mouseScreenY); ctx.lineTo(input.mouseScreenX - 5, input.mouseScreenY);
    ctx.moveTo(input.mouseScreenX + 5, input.mouseScreenY); ctx.lineTo(input.mouseScreenX + 13, input.mouseScreenY);
    ctx.moveTo(input.mouseScreenX, input.mouseScreenY - 13); ctx.lineTo(input.mouseScreenX, input.mouseScreenY - 5);
    ctx.moveTo(input.mouseScreenX, input.mouseScreenY + 5); ctx.lineTo(input.mouseScreenX, input.mouseScreenY + 13);
    ctx.stroke();
  }
  // Toast message, bottom centre, clear of the minimap below it.
  if (state.messageTimer > 0 && state.message) {
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    ctx.font = 'bold 16px sans-serif';
    const w = Math.min(ctx.measureText(state.message).width + 30, VIEW_W - 200);
    roundRect(ctx, VIEW_W / 2 - w / 2, VIEW_H - 240, w, 38, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, VIEW_W / 2, VIEW_H - 215);
  }
  drawMinimap(ctx, world);
}

function overlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(8,10,18,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || '#f2c200';
  ctx.font = 'bold 84px Georgia, serif';
  ctx.fillText(title, VIEW_W / 2, 300);
  ctx.fillStyle = '#f5eeda';
  ctx.font = '20px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 360 + i * 34));
}

export function drawTitle(ctx, world) {
  // Show the city behind the title: a slow pan over Downtown.
  const t = world.state.time;
  world.state.camera.x = 1800 + Math.sin(t * 0.05) * 300;
  world.state.camera.y = 1200 + Math.cos(t * 0.04) * 200;
  drawWorld(ctx, world);
  ctx.fillStyle = 'rgba(8,10,18,0.45)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c200';
  ctx.font = 'bold 96px Georgia, serif';
  ctx.fillText('COSTA VERDE', VIEW_W / 2, 250);
  ctx.fillStyle = '#fff';
  ctx.font = 'italic 26px Georgia, serif';
  ctx.fillText('An open-world crime story', VIEW_W / 2, 300);
  ctx.fillStyle = '#f5eeda';
  ctx.font = '19px sans-serif';
  const lines = [
    'Marco Solis owes Mama Rosa. Drive, steal, run — and pay her back.',
    'WASD / arrows — move & drive · E — enter / exit car · SPACE — punch',
    'Mouse click — shoot · SHIFT — run · P — pause · M — sound · R — restart',
    world.state.saveLoaded
      ? 'Save found — press ENTER to continue where you left off'
      : 'No save yet — your progress saves itself after every mission',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 380 + i * 32));
  const blink = Math.floor(t * 1.6) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#f2c200';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('PRESS SPACE TO START', VIEW_W / 2, 580);
  }
  if (world.state.best > 0) {
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Best fortune: $${world.state.best}`, VIEW_W / 2, 640);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '14px sans-serif';
  ctx.fillText('A 100% original game — its city, people, cars and story are invented here.', VIEW_W / 2, 760);
}

export function drawPaused(ctx) {
  overlay(ctx, 'PAUSED', ['Press P to keep playing', 'M — sound on/off · R — restart the story'], '#f5eeda');
}

export function drawBusted(ctx, world) {
  overlay(ctx, 'BUSTED', [
    'The CVPD caught up with you. The fine came straight out of your pocket.',
    'Press SPACE to walk out of the station and try again',
  ], '#4d7dff');
}

export function drawWasted(ctx) {
  overlay(ctx, 'WASTED', [
    'St. Alba Hospital patched you up — for a price.',
    'Press SPACE to get back on the streets',
  ], '#ff5a5a');
}

export function drawWin(ctx, world) {
  overlay(ctx, 'COSTA VERDE LEGEND', [
    `Marco paid Mama Rosa back — and kept $${world.state.cash} for himself.`,
    `Missions done: ${world.state.stats.missions} · Cars stolen: ${world.state.stats.stolen}`,
    'Press SPACE to keep cruising the city',
  ], '#f2c200');
}
