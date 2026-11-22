// Boot and the game loop: canvas setup, the mode machine (title, playing,
// paused, busted, wasted, win), the deterministic screenshot driver, and
// the save that the title screen offers back.

import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { drawWorld, drawHUD, drawTitle, drawPaused, drawBusted, drawWasted, drawWin } from './render.js';
import { parseShot, setupShot, autopilotInput } from './shots.js';
import { MISSIONS } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function resize() {
  // Fixed internal resolution: the render code lays the HUD out for
  // 1280x800 and the browser scales the canvas to the window.
  canvas.width = 1280;
  canvas.height = 800;
}
window.addEventListener('resize', resize);
resize();

const shot = parseShot();
const seed = shot.name ? shot.seed : (Date.now() % 100000) | 0;
const audio = createAudio();
const world = createWorld(seed, audio);
const input = createInput(canvas);
window.__game = world;

world.load();
let shotPlan = null;
let shotTicks = 0;
if (shot.name) {
  shotPlan = setupShot(world, shot.name);
  window.__shotReady = false;
} else {
  window.__shotReady = false;
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function startPlaying() {
  audio.unlock();
  audio.startMusic();
  world.state.mode = 'playing';
  if (!world.state.mission && world.state.missionIndex < MISSIONS.length) {
    world.startMission(world.state.missionIndex);
  }
  setStatus('Playing Costa Verde');
}

function freshGame() {
  try { localStorage.removeItem('costaverde-save-v1'); } catch { /* no storage */ }
  window.location.reload();
}

let last = performance.now();

function frame(now) {
  const rawDt = (now - last) / 1000;
  last = now;
  const dt = Math.min(rawDt, 0.05);
  const state = world.state;

  // World-space mouse for aiming.
  input.mouseX = input.mouseScreenX + state.camera.x - canvas.width / 2;
  input.mouseY = input.mouseScreenY + state.camera.y - canvas.height / 2;

  if (shotPlan) {
    // Deterministic screenshot: fixed steps with the scripted autopilot.
    // Park the crosshair in a corner so it never sits on the player.
    input.mouseScreenX = 1100;
    input.mouseScreenY = 150;
    if (shotTicks < shotPlan.ticks) {
      autopilotInput(world, shotPlan, input);
      world.update(1 / 60, input);
      shotTicks++;
    } else if (!window.__shotReady) {
      window.__shotReady = true;
    }
  } else {
    if (input.mute) { input.mute = false; world.state.muted = audio.toggleMute(); }
    if (input.restart) { input.restart = false; freshGame(); return; }
    if (state.mode === 'title') {
      state.time += dt;
      if (input.punch || input.confirm || input.shoot) {
        input.punch = false; input.confirm = false; input.shoot = false;
        startPlaying();
      }
    } else if (state.mode === 'playing') {
      if (input.pause) { input.pause = false; state.mode = 'paused'; audio.setEngine(0, false); }
      else world.update(dt, input);
    } else if (state.mode === 'paused') {
      if (input.pause) { input.pause = false; state.mode = 'playing'; }
    } else if (state.mode === 'busted' || state.mode === 'wasted') {
      if (input.punch || input.confirm) {
        input.punch = false; input.confirm = false;
        state.mode = 'playing';
        setStatus('Back on the streets');
      }
    } else if (state.mode === 'win') {
      if (input.punch || input.confirm) {
        input.punch = false; input.confirm = false;
        state.mode = 'playing';
      }
    }
  }

  // Render.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state.mode === 'title') {
    drawTitle(ctx, world);
  } else {
    drawWorld(ctx, world);
    if (state.mode === 'playing' || state.mode === 'paused') drawHUD(ctx, world, input);
    if (state.mode === 'paused') drawPaused(ctx);
    if (state.mode === 'busted') drawBusted(ctx, world);
    if (state.mode === 'wasted') drawWasted(ctx);
    if (state.mode === 'win') drawWin(ctx, world);
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
