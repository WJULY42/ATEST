// 输入系统：键盘 + 鼠标（含指针锁定）
export class Input {
  constructor(domElement) {
    this.keys = new Set();
    this.pressed = new Set(); // 本帧刚按下（边沿触发）
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseLocked = false;
    this.wheel = 0;
    this._el = domElement;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const code = e.code;
      this.keys.add(code);
      this.pressed.add(code);
      if (['Space', 'Tab', 'KeyM', 'F1'].includes(code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseLocked = false; });

    document.addEventListener('pointerlockchange', () => {
      this.mouseLocked = document.pointerLockElement === this._el;
    });
    window.addEventListener('mousemove', (e) => {
      if (this.mouseLocked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    window.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
  }

  lock() { this._el.requestPointerLock?.(); }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  axis(neg, pos) { return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0); }

  consumeMouse() {
    const d = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = 0; this.mouseDY = 0;
    return d;
  }
  endFrame() { this.pressed.clear(); this.wheel = 0; }
}
