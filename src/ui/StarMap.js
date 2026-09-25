// 星图（M 键）：Canvas 2D 绘制当前扇区，点击选择目标并跃迁
import { generateSector } from '../world/GalaxyGenerator.js';

export class StarMap {
  constructor(root, { onSelect, onClose }) {
    root.insertAdjacentHTML('beforeend', /* html */`
      <div id="starmap" class="overlay hidden">
        <div class="box wide">
          <h2>银 河 星 图 <small id="sm-sector"></small></h2>
          <canvas id="sm-canvas" width="720" height="480"></canvas>
          <div id="sm-info">点击星域选择跃迁目标 · 右键关闭</div>
          <button id="sm-close">关 闭 (M)</button>
        </div>
      </div>
    `);
    this.el = document.getElementById('starmap');
    this.canvas = document.getElementById('sm-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.info = document.getElementById('sm-info');
    document.getElementById('sm-close').onclick = onClose;
    this.onSelect = onSelect;
    this.systems = [];
    this.selected = null;
    this.origin = { x: 0, y: 0, z: 0 };
    this.hover = null;

    this.canvas.addEventListener('click', () => {
      if (this.hover) this.onSelect(this.hover);
    });
    this.canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); onClose(); });
    this.canvas.addEventListener('mousemove', (e) => {
      const r = this.canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      this.hover = null;
      for (const s of this.systems) {
        const p = this._toScreen(s.mapPos);
        if ((p.x - x) ** 2 + (p.y - y) ** 2 < 14 ** 2) { this.hover = s; break; }
      }
      this.canvas.style.cursor = this.hover ? 'pointer' : 'default';
      this.draw();
    });
  }

  open(seed, origin) {
    this.origin = { ...origin };
    this.systems = generateSector(seed, origin, 2);
    this.selected = null;
    document.getElementById('sm-sector').textContent =
      `扇区 ${origin.x},${origin.y},${origin.z}`;
    this.info.textContent = '点击星域选择跃迁目标 · 右键关闭';
    this.el.classList.remove('hidden');
    this.draw();
  }

  close() { this.el.classList.add('hidden'); }
  get visible() { return !this.el.classList.contains('hidden'); }

  _toScreen(pos) {
    const w = this.canvas.width, h = this.canvas.height;
    return {
      x: w / 2 + (pos.x - this.origin.x) * 130 + (pos.z - this.origin.z) * 30,
      y: h / 2 + (pos.y - this.origin.y) * 130 + (pos.z - this.origin.z) * 60,
    };
  }

  draw() {
    const { ctx } = this, w = this.canvas.width, h = this.canvas.height;
    ctx.fillStyle = '#04060f';
    ctx.fillRect(0, 0, w, h);
    // 背景星点（确定性）
    let sd = 12345;
    const rnd = () => ((sd = (Math.imul(sd, 16807) >>> 0) % 2147483647) / 2147483647);
    ctx.fillStyle = '#ffffff22';
    for (let i = 0; i < 160; i++) ctx.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
    // 连线到原点
    const o = this._toScreen(this.origin);
    ctx.strokeStyle = '#3fd0ff22';
    // 星域节点
    for (const s of this.systems) {
      const p = this._toScreen(s.mapPos);
      const isHere = s.coord.x === this.origin.x && s.coord.y === this.origin.y && s.coord.z === this.origin.z;
      const planetCount = s.planets.length;
      const col = isHere ? '#a5ff3f' : (this.hover === s || this.selected === s ? '#ffd83f' : '#3fd0ff');
      ctx.beginPath();
      ctx.arc(p.x, p.y, isHere ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.shadowColor = col; ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#cfe8ff';
      ctx.font = '10px monospace';
      ctx.fillText(`${s.name} (${planetCount})`, p.x + 10, p.y + 3);
    }
    // 当前坐标十字
    ctx.strokeStyle = '#a5ff3f66';
    ctx.beginPath();
    ctx.moveTo(o.x - 14, o.y); ctx.lineTo(o.x + 14, o.y);
    ctx.moveTo(o.x, o.y - 14); ctx.lineTo(o.x, o.y + 14);
    ctx.stroke();
  }
}
