// Keyboard and mouse state for Sunport Heat.
// One shared input object; the game reads it, the menus read it too.

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyE', 'KeyF', 'Space', 'KeyM', 'Enter', 'Escape',
  'Digit1', 'Digit2', 'Digit3',
]);

/** Create and bind the input state for a canvas element. */
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: false, // true for one frame after a click (consumed by the game)
    pressed: new Set(), // keys pressed since last frame (edge-triggered)
  };

  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) {
      input.keys.add(e.code);
      input.pressed.add(e.code);
    }
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.clicked = true;
    }
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });

  return input;
}

/** Was a key pressed since the last frame? */
export function wasPressed(input, code) {
  return input.pressed.has(code);
}

/** Clear the edge-triggered state. Call once per frame, after the update. */
export function endFrame(input) {
  input.pressed.clear();
  input.clicked = false;
}

/** Steering input: -1 left, +1 right. */
export function steerAxis(input) {
  let s = 0;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) s -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) s += 1;
  return s;
}

/** Throttle input: +1 forward, -1 brake/reverse, 0 none. */
export function throttleAxis(input) {
  let t = 0;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) t += 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) t -= 1;
  return t;
}

/** On-foot movement vector, normalized. */
export function moveAxis(input) {
  let x = 0;
  let y = 0;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) y -= 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.sqrt(2);
    x *= inv;
    y *= inv;
  }
  return { x, y };
}
