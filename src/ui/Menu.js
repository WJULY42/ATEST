// 菜单：开始界面 / 暂停 / 设置 / 死亡
export class Menu {
  constructor(root, handlers) {
    root.insertAdjacentHTML('beforeend', /* html */`
      <div id="menu-start" class="overlay">
        <div class="box">
          <h1 class="title">A<span>T</span>EST</h1>
          <p class="subtitle">无 人 深 空 · NOBODY'S SKY</p>
          <label class="seed-row">宇宙种子
            <input id="seed-input" type="text" placeholder="留空则随机" />
          </label>
          <button id="btn-new" class="primary">新 游 戏</button>
          <button id="btn-continue">继 续 探 索</button>
          <div class="help">
            WASD 移动 · 鼠标转向 · Shift 加速/Space 上升/Ctrl 下降<br/>
            G 着陆/起飞 · F 扫描 · E 采集 · M 星图跃迁 · Tab 背包 · C 视角 · Esc 暂停
          </div>
        </div>
      </div>

      <div id="menu-pause" class="overlay hidden">
        <div class="box">
          <h2>已 暂 停</h2>
          <button id="btn-resume" class="primary">继 续</button>
          <button id="btn-save">保 存 进 度</button>
          <label class="seed-row"><input id="chk-sound" type="checkbox" checked /> 音效</label>
          <label class="seed-row"><input id="chk-quality" type="checkbox" checked /> 高画质</label>
          <button id="btn-quit">返回主菜单</button>
        </div>
      </div>

      <div id="menu-death" class="overlay hidden">
        <div class="box">
          <h2 class="danger">信 号 丢 失</h2>
          <p>你的生命维持系统停止了运转。</p>
          <button id="btn-respawn" class="primary">在空间站重生</button>
          <button id="btn-death-menu">返回主菜单</button>
        </div>
      </div>
    `);
    const $ = (id) => document.getElementById(id);
    $('btn-new').onclick = () => handlers.newGame($('seed-input').value.trim());
    $('btn-continue').onclick = () => handlers.continue();
    $('btn-resume').onclick = () => handlers.resume();
    $('btn-save').onclick = () => handlers.save();
    $('btn-quit').onclick = () => handlers.quit();
    $('btn-respawn').onclick = () => handlers.respawn();
    $('btn-death-menu').onclick = () => handlers.quit();
    $('chk-sound').onchange = (e) => handlers.setSound?.(e.target.checked);
    $('chk-quality').onchange = (e) => handlers.setQuality?.(e.target.checked);
    this.$ = $;
    this.hasSave = !!handlers.hasSave;
    $('btn-continue').disabled = !this.hasSave;
  }

  show(name) {
    for (const m of ['start', 'pause', 'death']) {
      this.$('menu-' + m).classList.toggle('hidden', m !== name);
    }
  }
  hideAll() { this.show(null); }
}
