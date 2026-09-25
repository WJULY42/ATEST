// 通知系统（对象池思想：DOM 节点复用，定时移除）
export class Notifications {
  constructor(root) {
    root.insertAdjacentHTML('beforeend', '<div id="notifications"></div>');
    this.el = document.getElementById('notifications');
  }
  push(text, kind = 'info') {
    const d = document.createElement('div');
    d.className = 'notice ' + kind;
    d.textContent = text;
    this.el.appendChild(d);
    setTimeout(() => d.classList.add('fade'), 3200);
    setTimeout(() => d.remove(), 3900);
    while (this.el.children.length > 6) this.el.firstChild.remove();
  }
}
