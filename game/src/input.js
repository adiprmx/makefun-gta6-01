// Keyboard, mouse and touch input for Costa Verde. The game reads a single
// snapshot each frame: which keys are down, where the mouse is, and the clicks
// and key presses that happened since the last frame.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const touch = { active: false, x: 0, y: 0, startX: 0, startY: 0 };

  function keyName(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(keyName(e));
  });
  window.addEventListener('blur', () => {
    keys.clear();
  });

  // Mouse and touch coordinates are scaled into the canvas backing size, so
  // aiming stays exact whatever the window size is.
  function toCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  canvas.addEventListener('mousemove', (e) => {
    const p = toCanvas(e.clientX, e.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Touch: drag to move, tap the right half to shoot, two-finger tap to enter a car.
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    const p = toCanvas(t.clientX, t.clientY);
    touch.active = true;
    touch.startX = p.x;
    touch.startY = p.y;
    touch.x = touch.startX;
    touch.y = touch.startY;
    if (e.touches.length >= 2) pressed.add('e');
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    const p = toCanvas(t.clientX, t.clientY);
    touch.x = p.x;
    touch.y = p.y;
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (e.touches.length === 0) {
      if (touch.startX > canvas.width * 0.6 && Math.abs(touch.x - touch.startX) < 12) {
        mouse.clicked = true;
        mouse.x = touch.x;
        mouse.y = touch.y;
      }
      touch.active = false;
    }
  }, { passive: false });

  return {
    keys,
    mouse,
    touch,
    down(name) {
      return keys.has(name);
    },
    // True once, on the frame the key went down.
    wasPressed(name) {
      return pressed.has(name);
    },
    // Consume an edge-triggered press: true once, then gone, so one key press
    // can never fire twice when the accumulator runs several simulation steps
    // in a single rendered frame.
    consume(name) {
      const had = pressed.has(name);
      if (had) pressed.delete(name);
      return had;
    },
    // Consume a mouse click the same way.
    consumeClick() {
      const had = mouse.clicked;
      mouse.clicked = false;
      return had;
    },
    // Driving axes: -1..1 for steering, -1..1 for throttle.
    driveAxes() {
      let steer = 0;
      let throttle = 0;
      if (keys.has('a') || keys.has('ArrowLeft')) steer -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) steer += 1;
      if (keys.has('w') || keys.has('ArrowUp')) throttle += 1;
      if (keys.has('s') || keys.has('ArrowDown')) throttle -= 1;
      if (touch.active) {
        const dx = touch.x - touch.startX;
        const dy = touch.y - touch.startY;
        steer = Math.max(-1, Math.min(1, dx / 60));
        throttle = Math.max(-1, Math.min(1, -dy / 60));
      }
      return { steer, throttle };
    },
    // Walking axes: -1..1 on each axis.
    walkAxes() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) x += 1;
      if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('s') || keys.has('ArrowDown')) y += 1;
      if (touch.active) {
        x = Math.max(-1, Math.min(1, (touch.x - touch.startX) / 60));
        y = Math.max(-1, Math.min(1, (touch.y - touch.startY) / 60));
      }
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.sqrt(2);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    // Call once per frame, after the game has read the input.
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
