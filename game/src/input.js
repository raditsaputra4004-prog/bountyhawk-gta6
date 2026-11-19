// Keyboard and mouse state, kept as one small object the rest of the game
// reads each frame. Keys are tracked by their `code` so layouts do not
// matter, and every key press is also recorded as an edge (pressed this
// frame) so menus and actions can react exactly once.

const KEYS = new Set();
const PRESSED = new Set();
const MOUSE = { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 };

export const input = {
  keys: KEYS,
  pressed: PRESSED,
  mouse: MOUSE,

  down(code) {
    return KEYS.has(code);
  },
  hit(code) {
    return PRESSED.has(code);
  },
  // True while any of the given codes is held.
  any(codes) {
    for (const code of codes) if (KEYS.has(code)) return true;
    return false;
  },
  // Movement vector from WASD or arrows, normalised.
  move() {
    let x = 0;
    let y = 0;
    if (KEYS.has('KeyA') || KEYS.has('ArrowLeft')) x -= 1;
    if (KEYS.has('KeyD') || KEYS.has('ArrowRight')) x += 1;
    if (KEYS.has('KeyW') || KEYS.has('ArrowUp')) y -= 1;
    if (KEYS.has('KeyS') || KEYS.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  },
  // Clear the per-frame edges; call once at the end of each frame.
  endFrame() {
    PRESSED.clear();
    MOUSE.clicked = false;
  },
};

export function bindInput(canvas) {
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) {
      KEYS.add(event.code);
      PRESSED.add(event.code);
    }
  });
  window.addEventListener('keyup', (event) => {
    KEYS.delete(event.code);
  });
  window.addEventListener('blur', () => {
    KEYS.clear();
    MOUSE.down = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    MOUSE.x = event.clientX - rect.left;
    MOUSE.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      MOUSE.down = true;
      MOUSE.clicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) MOUSE.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}
