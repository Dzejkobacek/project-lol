/* Freshyard.cz – hero scene: a shaggy low-poly shrub that gets trimmed into a clean cube on scroll.
   Cut leaves fall as instanced particles; the cursor works as wind. Colours are the site palette only. */
import * as THREE from './vendor/three.module.min.js';

const PALETTE = {
  coal: 0x06140d,
  coal3: 0x0e2417,
  red: 0x0b8f38,
  redLight: 0x31dc63,
  green: 0x12b94a,
  blue: 0x075faa,
  cream: 0xf7fbf2,
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// deterministic pseudo random, so the shrub looks the same on every visit
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(49,220,99,1)');
  grd.addColorStop(0.35, 'rgba(49,220,99,.35)');
  grd.addColorStop(1, 'rgba(49,220,99,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function initHero(host, { getProgress, mobile }) {
  const W = () => host.clientWidth || innerWidth;
  const H = () => host.clientHeight || innerHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.75));
  renderer.setSize(W(), H());
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(PALETTE.coal, 0.055);

  const camera = new THREE.PerspectiveCamera(36, W() / H(), 0.1, 80);
  const camBase = new THREE.Vector3(0, 2.4, 11);
  camera.position.copy(camBase);

  /* ---- lights ---- */
  scene.add(new THREE.HemisphereLight(PALETTE.cream, PALETTE.coal, 0.55));
  const key = new THREE.DirectionalLight(PALETTE.cream, 1.6);
  key.position.set(-4, 7, 6);
  scene.add(key);
  const rim = new THREE.PointLight(PALETTE.redLight, 30, 14, 1.6);
  rim.position.set(3, 4.5, -2.5);
  scene.add(rim);
  const fill = new THREE.PointLight(PALETTE.blue, 22, 16, 1.6);
  fill.position.set(-4, 1.5, -3);
  scene.add(fill);

  /* ---- world group (offset to the right on desktop) ---- */
  const world = new THREE.Group();
  scene.add(world);
  const layout = () => {
    const aspect = W() / H();
    if (aspect < 0.9) { world.position.set(0, -2.1, 0); world.scale.setScalar(0.82); }
    else { world.position.set(Math.min(4.2, 1.6 + aspect * 1.3), -0.6, 0); world.scale.setScalar(1); }
  };
  layout();

  const CROWN_Y = 3.05;
  const BOX = 1.12; // half-size of the trimmed cube

  /* ---- ground ---- */
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(7, 40),
    new THREE.MeshStandardMaterial({ color: PALETTE.coal3, roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  world.add(ground);

  const glowTex = glowTexture();
  const groundGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 7),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  groundGlow.rotation.x = -Math.PI / 2;
  groundGlow.position.y = 0.01;
  world.add(groundGlow);

  /* ---- trunk + planter ---- */
  const trunkMat = new THREE.MeshStandardMaterial({ color: PALETTE.coal3, roughness: 0.9, flatShading: true, emissive: PALETTE.red, emissiveIntensity: 0.06 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, CROWN_Y - 0.6, 7), trunkMat);
  trunk.position.y = (CROWN_Y - 0.6) / 2;
  world.add(trunk);
  const branchGeo = new THREE.CylinderGeometry(0.04, 0.08, 1.1, 5);
  [[0.5, 0.9, 0.2], [-0.6, 0.7, -0.3], [0.1, 0.8, 0.7]].forEach(([x, rz, rx]) => {
    const b = new THREE.Mesh(branchGeo, trunkMat);
    b.position.set(x * 0.6, CROWN_Y - 0.55, 0);
    b.rotation.set(rx, 0, -x * rz);
    world.add(b);
  });
  const roots = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.35, 7), trunkMat);
  roots.position.y = 0.17;
  world.add(roots);

  /* ---- glow behind the crown ---- */
  const crownGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
  crownGlow.scale.set(7, 7, 1);
  crownGlow.position.set(0, CROWN_Y, -1.6);
  world.add(crownGlow);

  /* ---- leaves ---- */
  const rand = rng(174);
  const KEEP = mobile ? 520 : 1300;   // leaves that end up on the clean cube surface
  const CUT = mobile ? 480 : 1300;    // leaves that get trimmed off and fall
  const N = KEEP + CUT;

  const leafGeo = new THREE.OctahedronGeometry(1, 0);
  leafGeo.scale(1, 0.32, 0.7);
  const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.05, flatShading: true });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, N);
  leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  world.add(leaves);

  const cols = [PALETTE.red, PALETTE.green, PALETTE.redLight, PALETTE.coal3, PALETTE.red, PALETTE.green].map((c) => new THREE.Color(c));

  const wild = new Float32Array(N * 3);   // shaggy start position
  const clean = new Float32Array(N * 3);  // trimmed position (keep leaves)
  const vel = new Float32Array(N * 3);    // fall velocity (cut leaves)
  const off = new Float32Array(N * 3);    // wind offset (spring)
  const rot = new Float32Array(N * 3);
  const spin = new Float32Array(N);
  const scl = new Float32Array(N);
  const order = new Float32Array(N);      // when a cut leaf detaches (0..1)
  const phase = new Float32Array(N);

  // noisy, lumpy crown radius in a direction
  const lump = (x, y, z) => 1 + 0.22 * Math.sin(x * 3.1 + y * 1.7) * Math.cos(z * 2.6 - y * 2.2) + 0.12 * Math.sin(x * 7 + z * 5);

  for (let i = 0; i < N; i++) {
    const keep = i < KEEP;
    const j = i * 3;
    if (keep) {
      // point on the cube surface
      const face = Math.floor(rand() * 6);
      const u = (rand() * 2 - 1) * BOX, v = (rand() * 2 - 1) * BOX;
      let x, y, z;
      const s = BOX + (rand() - 0.5) * 0.05;
      switch (face) {
        case 0: x = s; y = u; z = v; break;
        case 1: x = -s; y = u; z = v; break;
        case 2: y = s; x = u; z = v; break;
        case 3: y = -s; x = u; z = v; break;
        case 4: z = s; x = u; y = v; break;
        default: z = -s; x = u; y = v;
      }
      clean[j] = x; clean[j + 1] = y + CROWN_Y; clean[j + 2] = z;
      // wild: push outward to the lumpy ellipsoid
      const len = Math.hypot(x, y, z) || 1;
      const nx = x / len, ny = y / len, nz = z / len;
      const R = 1.55 * lump(nx, ny, nz) * (0.86 + rand() * 0.2);
      wild[j] = nx * R * 1.08; wild[j + 1] = ny * R * 0.92 + CROWN_Y; wild[j + 2] = nz * R * 1.08;
      scl[i] = 0.1 + rand() * 0.07;
    } else {
      // point in the shaggy shell outside the cube
      let x, y, z, len;
      do {
        x = rand() * 2 - 1; y = rand() * 2 - 1; z = rand() * 2 - 1;
        len = Math.hypot(x, y, z);
      } while (len > 1 || len < 0.2);
      const nx = x / len, ny = y / len, nz = z / len;
      const R = 1.62 * lump(nx, ny, nz) * (0.92 + rand() * 0.38);
      let px = nx * R * 1.1, py = ny * R * 0.95, pz = nz * R * 1.1;
      // make sure it sits outside the cube so the cut is visible
      const m = Math.max(Math.abs(px), Math.abs(py), Math.abs(pz));
      if (m < BOX * 1.08) { const k = (BOX * 1.08 + rand() * 0.3) / m; px *= k; py *= k; pz *= k; }
      // a few stray twigs sticking out
      if (rand() < 0.08) { px *= 1.25; py *= 1.2; pz *= 1.25; }
      wild[j] = px; wild[j + 1] = py + CROWN_Y; wild[j + 2] = pz;
      const hl = Math.hypot(px, pz) || 1;
      vel[j] = (px / hl) * (0.6 + rand() * 1.2);
      vel[j + 1] = 0.8 + rand() * 1.6;
      vel[j + 2] = (pz / hl) * (0.6 + rand() * 1.2);
      // trimmer sweeps top-down with some randomness
      order[i] = clamp(0.06 + (1 - (py + 1.9) / 3.8) * 0.62 + rand() * 0.14, 0.04, 0.86);
      spin[i] = (rand() - 0.5) * 18;
      scl[i] = 0.1 + rand() * 0.09;
    }
    rot[j] = rand() * Math.PI; rot[j + 1] = rand() * Math.PI; rot[j + 2] = rand() * Math.PI;
    phase[i] = rand() * Math.PI * 2;
    leaves.setColorAt(i, cols[Math.floor(rand() * cols.length)]);
  }
  leaves.instanceColor.needsUpdate = true;

  /* ---- glowing cut plane that sweeps down ---- */
  const cutPlane = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 2.6, 48),
    new THREE.MeshBasicMaterial({ map: glowTex, color: PALETTE.redLight, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  cutPlane.rotation.x = -Math.PI / 2;
  world.add(cutPlane);
  const cutEdge = new THREE.Mesh(
    new THREE.TorusGeometry(1.75, 0.012, 6, 80),
    new THREE.MeshBasicMaterial({ color: PALETTE.redLight, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  cutEdge.rotation.x = Math.PI / 2;
  world.add(cutEdge);

  /* ---- floating spores / dust ---- */
  const P = mobile ? 140 : 420;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(P * 3);
  const pBase = new Float32Array(P * 3);
  for (let i = 0; i < P; i++) {
    pBase[i * 3] = (rand() - 0.5) * 14;
    pBase[i * 3 + 1] = rand() * 7;
    pBase[i * 3 + 2] = (rand() - 0.5) * 8;
  }
  pPos.set(pBase);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const spores = new THREE.Points(pGeo, new THREE.PointsMaterial({
    map: glowTex, size: 0.14, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, color: PALETTE.redLight,
  }));
  world.add(spores);

  /* ---- pointer = wind ---- */
  const ndc = new THREE.Vector2(0, 0);
  const ndcSmooth = new THREE.Vector2(0, 0);
  let pointerActive = false;
  const onMove = (e) => {
    const r = host.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    pointerActive = true;
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerleave', () => (pointerActive = false));
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  const windLocal = new THREE.Vector3(999, 999, 999);

  /* ---- per-frame ---- */
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const clock = new THREE.Clock();
  let prog = 0;
  let visible = true;
  let raf = 0;

  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    clock.getDelta();
    const t = clock.elapsedTime;
    prog += (getProgress() - prog) * 0.12;

    // camera parallax
    ndcSmooth.lerp(ndc, 0.06);
    camera.position.set(camBase.x + ndcSmooth.x * 0.9, camBase.y + ndcSmooth.y * 0.5 + prog * 0.6, camBase.z - prog * 1.2);
    camera.lookAt(world.position.x * 0.55, 2.3 + world.position.y * 0.6, 0);

    world.rotation.y = Math.sin(t * 0.18) * 0.35 + prog * 0.9;

    // wind position in world-local space
    if (pointerActive) {
      ray.setFromCamera(ndc, camera);
      plane.constant = -world.position.z;
      if (ray.ray.intersectPlane(plane, hit)) windLocal.copy(world.worldToLocal(hit.clone()));
    } else windLocal.set(999, 999, 999);

    // morph: 0 = wild, 1 = clean
    const morph = smooth(0.1, 0.92, prog);
    const sweepY = CROWN_Y + 2.1 - smooth(0.04, 0.9, prog) * 4.3;

    for (let i = 0; i < N; i++) {
      const j = i * 3;
      let x, y, z, s = scl[i];
      let rx = rot[j], ry = rot[j + 1], rz = rot[j + 2];
      const sway = Math.sin(t * 1.6 + phase[i]) * 0.025;

      if (i < KEEP) {
        x = wild[j] + (clean[j] - wild[j]) * morph;
        y = wild[j + 1] + (clean[j + 1] - wild[j + 1]) * morph;
        z = wild[j + 2] + (clean[j + 2] - wild[j + 2]) * morph;
        // leaves align and shrink slightly once trimmed – reads as a clean hedge face
        s *= 1 + morph * 0.45;
        rx *= 1 - morph * 0.85; rz *= 1 - morph * 0.85;
        x += sway * (1 - morph); y += sway * 0.5;
      } else {
        const ft = Math.max(0, (prog - order[i]) * 3.4); // time since this leaf was cut
        x = wild[j]; y = wild[j + 1]; z = wild[j + 2];
        if (ft > 0) {
          x += vel[j] * ft;
          z += vel[j + 2] * ft;
          y += vel[j + 1] * ft - 4.2 * ft * ft;
          if (y < 0.04) { y = 0.04; rx = 0; rz = Math.PI / 2 * 0.1; }
          else { rx += spin[i] * ft; rz += spin[i] * 0.6 * ft; }
          s *= clamp(1.2 - ft * 0.35, 0.35, 1);
        } else {
          x += sway; y += sway * 0.6;
        }
      }

      // wind spring
      const dx = x - windLocal.x, dy = y - windLocal.y, dz = z - windLocal.z;
      const d2 = dx * dx + dy * dy + dz * dz * 0.25;
      let tx = 0, ty = 0, tz = 0;
      if (d2 < 2.4) {
        const d = Math.sqrt(d2) || 0.001;
        const f = Math.pow(1 - d / 1.55, 2) * 0.75;
        if (f > 0) { tx = (dx / d) * f; ty = (dy / d) * f * 0.6; tz = 0.3 * f; }
      }
      off[j] += (tx - off[j]) * 0.09;
      off[j + 1] += (ty - off[j + 1]) * 0.09;
      off[j + 2] += (tz - off[j + 2]) * 0.09;

      pos.set(x + off[j], y + off[j + 1], z + off[j + 2]);
      e.set(rx + off[j] * 2, ry, rz + off[j + 1] * 2);
      q.setFromEuler(e);
      sc.set(s, s, s);
      m4.compose(pos, q, sc);
      leaves.setMatrixAt(i, m4);
    }
    leaves.instanceMatrix.needsUpdate = true;

    // cut plane
    const cutActive = smooth(0.02, 0.1, prog) * (1 - smooth(0.82, 0.95, prog));
    cutPlane.position.y = sweepY;
    cutEdge.position.y = sweepY;
    cutPlane.material.opacity = 0.55 * cutActive;
    cutEdge.material.opacity = 0.9 * cutActive;
    cutEdge.scale.setScalar(1 + Math.sin(t * 6) * 0.02);
    crownGlow.material.opacity = 0.26 + morph * 0.18 + Math.sin(t * 1.3) * 0.03;
    rim.intensity = 26 + morph * 18;

    // spores drift upward and dodge the pointer
    for (let i = 0; i < P; i++) {
      const j = i * 3;
      let y = (pBase[j + 1] + t * 0.18 + phase[i % N]) % 7;
      let x = pBase[j] + Math.sin(t * 0.4 + i) * 0.3;
      let z = pBase[j + 2];
      const dx = x - windLocal.x, dy = y - windLocal.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 2.5) { const d = Math.sqrt(d2) || 0.01; const f = (1 - d / 1.58) * 0.9; x += (dx / d) * f; y += (dy / d) * f; }
      pPos[j] = x; pPos[j + 1] = y; pPos[j + 2] = z;
    }
    pGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  };
  frame();

  /* ---- visibility + resize ---- */
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) clock.getDelta(); }).observe(host);
  let rT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      renderer.setSize(W(), H());
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
      layout();
    }, 120);
  });

  // fps guard: if the device struggles, drop pixel ratio
  let frames = 0; const t0 = performance.now();
  const probe = () => {
    frames++;
    if (performance.now() - t0 < 2000) requestAnimationFrame(probe);
    else if (frames < 70) renderer.setPixelRatio(1);
  };
  requestAnimationFrame(probe);

  return { destroy() { cancelAnimationFrame(raf); renderer.dispose(); } };
}
