// HUD：速度/高度/燃料/氧气/生命/护盾/坐标/目标/准星/罗盘
export class HUD {
  constructor(root) {
    root.insertAdjacentHTML('beforeend', /* html */`
      <div id="hud" class="hidden">
        <div id="crosshair"><div></div></div>
        <div id="compass"><div id="compass-ticks"></div><div id="compass-marker">▼</div></div>
        <div id="hud-left" class="panel">
          <div class="stat"><span class="label">生命</span><div class="bar"><i id="bar-health" style="background:#ff4d6a"></i></div><b id="val-health">100</b></div>
          <div class="stat"><span class="label">护盾</span><div class="bar"><i id="bar-shield" style="background:#3fd0ff"></i></div><b id="val-shield">100</b></div>
          <div class="stat"><span class="label">氧气</span><div class="bar"><i id="bar-oxygen" style="background:#a5ff3f"></i></div><b id="val-oxygen">100</b></div>
          <div class="stat"><span class="label">燃料</span><div class="bar"><i id="bar-fuel" style="background:#ffb03f"></i></div><b id="val-fuel">100</b></div>
        </div>
        <div id="hud-right" class="panel">
          <div><span class="label">速度</span> <b id="val-speed">0</b> u/s</div>
          <div><span class="label">高度</span> <b id="val-alt">0</b> u</div>
          <div><span class="label">坐标</span> <b id="val-coord">0,0,0</b></div>
          <div><span class="label">模式</span> <b id="val-mode">太空</b></div>
        </div>
        <div id="hud-target" class="panel hidden">
          <span class="label">目标</span> <b id="val-target"></b> <span id="val-target-dist"></span>
        </div>
        <div id="hud-quests" class="panel"></div>
        <div id="hud-hint" class="panel hidden"></div>
        <div id="scan-flash"></div>
      </div>
    `);
    this.el = document.getElementById('hud');
    this.$ = (id) => document.getElementById(id);
    this.bars = ['health', 'shield', 'oxygen', 'fuel'].map((k) => ({
      bar: this.$('bar-' + k), val: this.$('val-' + k),
    }));
    this.compassTicks = this.$('compass-ticks');
    this._buildCompass();
  }

  _buildCompass() {
    const dirs = ['北', '', '东', '', '南', '', '西', ''];
    let html = '';
    for (let i = 0; i < 8; i++) {
      if (dirs[i]) html += `<span style="left:${i * 12.5}%">${dirs[i]}</span>`;
    }
    this.compassTicks.innerHTML = html;
  }

  show(v) { this.el.classList.toggle('hidden', !v); }

  update(state) {
    const stats = [state.health, state.shield, state.oxygen, state.fuel];
    stats.forEach((v, i) => {
      this.bars[i].bar.style.width = Math.max(0, Math.min(100, v)) + '%';
      this.bars[i].val.textContent = Math.round(v);
    });
    this.$('val-speed').textContent = Math.round(state.speed);
    this.$('val-alt').textContent = Math.round(state.altitude);
    this.$('val-coord').textContent = state.coord;
    this.$('val-mode').textContent = state.mode === 'ground' ? '地表' : state.mode === 'warp' ? '跃迁' : '太空';
    // 罗盘：偏航角映射到 0-360
    const yawDeg = ((state.yaw % 360) + 360) % 360;
    this.compassTicks.style.transform = `translateX(${-yawDeg / 360 * 400}px)`;
    // 目标
    const tgt = this.$('hud-target');
    if (state.target) {
      tgt.classList.remove('hidden');
      this.$('val-target').textContent = state.target.name;
      this.$('val-target-dist').textContent = ' · ' + Math.round(state.target.dist) + 'u';
    } else tgt.classList.add('hidden');
    // 任务
    this.$('hud-quests').innerHTML = state.quests
      .map((q) => `<div>◆ ${q.text}${q.done ? ' <s style="opacity:.5">完成</s>' : ''}</div>`).join('');
    // 交互提示
    const hint = this.$('hud-hint');
    if (state.hint) { hint.classList.remove('hidden'); hint.textContent = state.hint; }
    else hint.classList.add('hidden');
  }

  scanPulse() {
    const f = this.$('scan-flash');
    f.classList.remove('active');
    void f.offsetWidth;
    f.classList.add('active');
  }
}
