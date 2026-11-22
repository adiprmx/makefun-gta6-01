// Costa Verde's boot: wire input, audio, world and renderer together, run the
// fixed-step simulation, and serve the deterministic screenshot scenarios.
import { createWorld } from './world.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const input = createInput(canvas);
const audio = createAudio();
const world = createWorld(input, audio);
const renderer = createRenderer(canvas);

// Debug hook for the screenshot driver and for play-testing: window.__game.
window.__game = world;
window.__shotReady = false;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '1');
void seed;

function announce(text) {
  if (statusLine) statusLine.textContent = text;
}

if (shotName) {
  // Screenshot mode: run the scenario with fixed steps, render once, flag ready.
  // No wall-clock time is involved, so a re-shoot is byte-identical.
  const plan = setupShot(world, input, shotName);
  for (let i = 0; i < plan.frames; i++) {
    world.update(world.fixedStep);
    input.endFrame();
  }
  renderer.render(world);
  announce(`Costa Verde screenshot ${shotName}: ${world.districtName()}, mission ${world.mission ? world.mission.name : 'none'}`);
  window.__shotReady = true;
} else {
  // Live play: a fixed-step accumulator keeps the simulation identical at any
  // frame rate, and the menu keys work from every screen.
  let last = performance.now();
  let acc = 0;
  const STEP = world.fixedStep;

  function frame(now) {
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += elapsed;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      world.update(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 5) acc = 0;

    if (world.state === 'title') {
      if (input.consume('Enter') || input.mouse.clicked) {
        world.startGame(false);
        announce('Costa Verde: game started');
      } else if (input.consume('n')) {
        world.startGame(true);
        announce('Costa Verde: new game started');
      }
    } else if (world.state === 'busted' || world.state === 'wasted' || world.state === 'win') {
      if (input.consume('Enter')) world.toTitle();
    } else if (world.state === 'paused') {
      if (input.consume('p') || input.consume('Escape') || input.consume('Enter')) {
        world.state = 'playing';
      }
    }

    renderer.render(world);
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
