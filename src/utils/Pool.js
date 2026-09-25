// 对象池：小行星、粒子、采集物、通知等复用，减少 GC
export class Pool {
  constructor(factory, reset = () => {}, initial = 0) {
    this.factory = factory;
    this.reset = reset;
    this.free = [];
    this.active = new Set();
    for (let i = 0; i < initial; i++) this.free.push(factory());
  }

  acquire(...args) {
    const obj = this.free.length ? this.free.pop() : this.factory();
    this.reset(obj, ...args);
    this.active.add(obj);
    return obj;
  }

  release(obj) {
    if (this.active.delete(obj)) {
      this.reset(obj);
      this.free.push(obj);
    }
  }

  releaseAll() {
    for (const o of [...this.active]) this.release(o);
  }
}
