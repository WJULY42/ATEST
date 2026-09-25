// 背包 UI（Tab 开关）
export class InventoryUI {
  constructor(root, { onClose }) {
    root.insertAdjacentHTML('beforeend', /* html */`
      <div id="inventory" class="overlay hidden">
        <div class="box">
          <h2>货 物 仓</h2>
          <div id="inv-grid"></div>
          <div id="inv-foot">采集资源会存放于此。燃料与氧气可在补给站或地表采集补充。</div>
          <button id="inv-close">关 闭 (Tab)</button>
        </div>
      </div>
    `);
    this.el = document.getElementById('inventory');
    this.grid = document.getElementById('inv-grid');
    document.getElementById('inv-close').onclick = onClose;
  }

  open(inventory) {
    this.el.classList.remove('hidden');
    this.render(inventory);
  }
  close() { this.el.classList.add('hidden'); }
  get visible() { return !this.el.classList.contains('hidden'); }

  render(inventory) {
    const entries = Object.entries(inventory).filter(([, v]) => v > 0);
    this.grid.innerHTML = entries.length
      ? entries.map(([k, v]) => `<div class="item"><b>${k}</b><span>x${v}</span></div>`).join('')
      : '<div class="empty">— 空空如也 —</div>';
  }
}
