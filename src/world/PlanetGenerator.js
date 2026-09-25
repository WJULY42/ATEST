import * as THREE from 'three';
import { planetTexture } from './Textures.js';

// 行星视觉体：低多边形球 + 大气辉光 + 可选行星环
export function createPlanetMesh(params, lod = 'high') {
  const group = new THREE.Group();
  const seg = lod === 'high' ? [48, 32] : [20, 14];
  const geo = new THREE.SphereGeometry(params.radius, seg[0], seg[1]);
  // 低多边形风格：非索引化 + 平面法线
  if (lod === 'low') {
    geo.deleteAttribute('normal');
    geo = geo.toNonIndexed();
    geo.computeVertexNormals();
  }
  const tex = planetTexture(
    params.seed, params.biome.palette, params.biome.water, params.biome.atmosphere
  );
  const mat = new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.95, metalness: 0.02,
    emissive: new THREE.Color(params.biome.palette[1]), emissiveIntensity: 0.04,
  });
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);

  // 大气壳（背面渲染 + AdditiveBlending 假菲涅尔）
  const atmoMat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(params.biome.atmosphere) },
      uPower: { value: 3.2 },
    },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vP;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vP = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uPower;
      varying vec3 vN; varying vec3 vP;
      void main() {
        float f = pow(clamp(dot(normalize(vN), normalize(-vP)), 0.0, 1.0), uPower);
        gl_FragColor = vec4(uColor, f * 0.85);
      }`,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(params.radius * 1.06, 24, 16), atmoMat);
  group.add(atmo);

  // 行星环
  if (params.hasRing) {
    const ringGeo = new THREE.RingGeometry(params.radius * 1.5, params.radius * 2.3, 48);
    const rng = Math.random;
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(params.biome.palette[2]),
      transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2 + params.axialTilt;
    group.add(ring);
  }

  group.rotation.z = params.axialTilt;
  group.userData.params = params;
  group.userData.mesh = mesh;
  return group;
}
