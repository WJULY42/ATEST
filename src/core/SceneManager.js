import * as THREE from 'three';

// 场景管理：太空场景与地表场景分离，各自持有相机
class ManagedScene {
  constructor(name) {
    this.name = name;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400000);
    this.camera.rotation.order = 'YXZ';
    this.entities = [];
  }
  add(obj) { this.scene.add(obj); this.entities.push(obj); }
  clearKeep(...keep) {
    for (const e of this.entities) {
      if (!keep.includes(e)) this.scene.remove(e);
    }
    this.entities = this.entities.filter((e) => keep.includes(e));
  }
}

export class SceneManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.space = new ManagedScene('space');
    this.ground = new ManagedScene('ground');
    this.current = this.space;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    for (const s of [this.space, this.ground]) {
      s.camera.aspect = w / h;
      s.camera.updateProjectionMatrix();
    }
  }

  switchTo(name) {
    this.current = name === 'ground' ? this.ground : this.space;
    return this.current;
  }

  render() {
    this.renderer.render(this.current.scene, this.current.camera);
  }
}
