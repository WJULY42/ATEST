// 存档系统：localStorage（种子、位置、资源、任务、飞船状态、设置）
const KEY = 'atest-save-v1';

export class SaveSystem {
  static hasSave() {
    try { return !!localStorage.getItem(KEY); } catch { return false; }
  }
  static save(state) {
    try { localStorage.setItem(KEY, JSON.stringify({ ...state, ts: Date.now() })); return true; }
    catch { return false; }
  }
  static load() {
    try {
      const s = localStorage.getItem(KEY);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }
  static clear() { localStorage.removeItem(KEY); }
}
