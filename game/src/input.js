// Keyboard, mouse and touch input, translated into one plain object the
// world update reads. Edge-triggered actions (enter car, pause) are consumed
// by the reader, so one key press never fires twice.

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    up: false, down: false, left: false, right: false, run: false,
    punch: false, shoot: false, enter: false, pause: false,
    mouseX: 0, mouseY: 0, mouseScreenX: 640, mouseScreenY: 400,
    anyKey: false,
  };

  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ShiftLeft: 'run', ShiftRight: 'run',
    Space: 'punch',
  };

  function refresh() {
    input.up = keys.has('up');
    input.down = keys.has('down');
    input.left = keys.has('left');
    input.right = keys.has('right');
    input.run = keys.has('run');
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    input.anyKey = true;
    if (e.code === 'KeyE' && !e.repeat) input.enter = true;
    if (e.code === 'KeyP' && !e.repeat) input.pause = true;
    if (e.code === 'KeyM' && !e.repeat) input.mute = true;
    if (e.code === 'KeyR' && !e.repeat) input.restart = true;
    if (e.code === 'Enter' && !e.repeat) input.confirm = true;
    const mapped = KEYMAP[e.code];
    if (mapped) {
      keys.add(mapped);
      if (mapped === 'punch') input.punch = true;
      refresh();
    }
  });
  window.addEventListener('keyup', (e) => {
    const mapped = KEYMAP[e.code];
    if (mapped) {
      keys.delete(mapped);
      if (mapped === 'punch') input.punch = false;
      refresh();
    }
  });
  window.addEventListener('blur', () => { keys.clear(); refresh(); });

  function setMouse(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    input.mouseScreenX = (clientX - rect.left) * (canvas.width / rect.width);
    input.mouseScreenY = (clientY - rect.top) * (canvas.height / rect.height);
  }

  canvas.addEventListener('mousemove', (e) => setMouse(e.clientX, e.clientY));
  canvas.addEventListener('mousedown', (e) => {
    setMouse(e.clientX, e.clientY);
    input.shoot = true;
    input.anyKey = true;
  });
  window.addEventListener('mouseup', () => { input.shoot = false; });

  // Touch: left half steers/moves, right half is the action side.
  let touchId = null;
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    touchId = t.identifier;
    setMouse(t.clientX, t.clientY);
    input.shoot = true;
    input.anyKey = true;
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) if (t.identifier === touchId) input.shoot = false;
  });

  return input;
}
