/* =========================================================
   BoxTeplo 3D – interaktivní chytrý box (Three.js, globální build)
   Tok: vyber dvířka → objednej → ohřev → kód → vyzvedni
   ========================================================= */
(function () {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = $("#scene");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (err) {
    $("#fallback").hidden = false;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  /* ---------- Pomocné funkce ---------- */
  const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeIn = (t) => t * t;

  function canvasTexture(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    draw(ctx, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { tex, canvas: c, ctx };
  }

  function roundedRectShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function roundedBox(w, h, d, r, bevel) {
    const g = new THREE.ExtrudeGeometry(roundedRectShape(w, d, r), {
      depth: h - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 6,
    });
    g.rotateX(-Math.PI / 2);
    g.center();
    return g;
  }
  const box = (w, h, d, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  /* ---------- Světla ---------- */
  scene.add(new THREE.HemisphereLight(0xfff3e6, 0xdfeee4, 0.95));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(4, 8, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -3, near: 1, far: 25 });
  sun.shadow.bias = -0.0004;
  sun.shadow.radius = 5;
  scene.add(sun);
  const rim = new THREE.PointLight(0xffa860, 14, 20, 2);
  rim.position.set(-5, 3, 3);
  scene.add(rim);
  const heatLight = new THREE.PointLight(0xff8a2a, 0, 3.2, 2); // světlo uvnitř vybraného boxu
  scene.add(heatLight);

  /* ---------- Podlaha ---------- */
  const glow = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(230,126,34,.30)");
    g.addColorStop(0.55, "rgba(230,126,34,.08)");
    g.addColorStop(1, "rgba(230,126,34,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  const glowDisc = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: glow.tex, transparent: true, depthWrite: false }));
  glowDisc.rotation.x = -Math.PI / 2; glowDisc.position.y = 0.002;
  scene.add(glowDisc);
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.22 }));
  shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  /* ---------- Box (skříň) ---------- */
  const COLS = 3, ROWS = 3, CW = 1.2, CH = 1.0, DEPTH = 1.1, T = 0.04;
  const PX = CW + T, PY = CH + T;                       // rozteč buněk
  const BASE = 0.2;
  const lockerW = COLS * PX + T;
  const lockerTop = BASE + ROWS * PY + T;
  const FRONT = DEPTH / 2;

  const mBody = new THREE.MeshStandardMaterial({ color: 0xf1ebe3, roughness: 0.55, metalness: 0.05 });
  const mDark = new THREE.MeshStandardMaterial({ color: 0x2a2521, roughness: 0.6 });
  const mInner = new THREE.MeshStandardMaterial({ color: 0xfbe9d4, roughness: 0.8, side: THREE.DoubleSide });
  const mCream = new THREE.MeshStandardMaterial({ color: 0xfffaf4, roughness: 0.45 });
  const mOrange = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.4 });
  const mHandle = new THREE.MeshStandardMaterial({ color: 0x3b342f, roughness: 0.35, metalness: 0.5 });

  const locker = new THREE.Group();
  scene.add(locker);

  const plinth = box(lockerW + 0.1, BASE, DEPTH + 0.1, mDark);
  plinth.position.set(0, BASE / 2, 0);
  locker.add(plinth);
  const back = box(lockerW, lockerTop, 0.05, mInner); back.position.set(0, lockerTop / 2, -FRONT + 0.025); locker.add(back);
  for (let i = 0; i <= COLS; i++) {
    const v = box(T, ROWS * PY + T, DEPTH, mBody);
    v.position.set((i - COLS / 2) * PX, BASE + (ROWS * PY + T) / 2, 0);
    locker.add(v);
  }
  for (let j = 0; j <= ROWS; j++) {
    const hz = box(lockerW, T, DEPTH, mBody);
    hz.position.set(0, BASE + T / 2 + j * PY, 0);
    locker.add(hz);
  }
  // horní část s displejem
  const capH = 0.58;
  const cap = box(lockerW + 0.1, capH, DEPTH + 0.1, mBody);
  cap.position.set(0, lockerTop + capH / 2, 0);
  locker.add(cap);
  const accent = box(lockerW + 0.12, 0.05, DEPTH + 0.12, mOrange);
  accent.position.set(0, lockerTop + 0.025, 0);
  locker.add(accent);

  // displej
  const display = canvasTexture(1024, 160, () => {});
  function drawDisplay(line1, line2, color) {
    const { ctx, tex } = display;
    ctx.fillStyle = "#1d1a17"; ctx.fillRect(0, 0, 1024, 160);
    ctx.fillStyle = "#e67e22"; ctx.font = "700 30px Outfit, Inter, sans-serif"; ctx.textBaseline = "alphabetic";
    ctx.fillText("BoxTeplo", 40, 52);
    ctx.fillStyle = "#6b625a"; ctx.font = "500 22px Inter, sans-serif";
    ctx.fillText("Objednej · Vyzvedni · Ohřej · Jdi", 40, 138);
    ctx.fillStyle = color || "#ffffff"; ctx.font = "700 46px Outfit, Inter, sans-serif"; ctx.textAlign = "right";
    ctx.fillText(line1, 984, 70);
    ctx.fillStyle = "#a69e95"; ctx.font = "500 24px Inter, sans-serif";
    ctx.fillText(line2, 984, 118);
    ctx.textAlign = "left";
    tex.needsUpdate = true;
  }
  const dispMesh = new THREE.Mesh(new THREE.PlaneGeometry(lockerW - 0.3, 0.4), new THREE.MeshBasicMaterial({ map: display.tex, toneMapped: false }));
  dispMesh.position.set(0, lockerTop + 0.31, DEPTH / 2 + 0.07);
  locker.add(dispMesh);
  const dispFrame = box(lockerW - 0.22, 0.48, 0.02, mDark);
  dispFrame.position.set(0, lockerTop + 0.31, DEPTH / 2 + 0.05);
  locker.add(dispFrame);
  // QR čtečka a "NFC" kroužek
  const qr = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({
    map: canvasTexture(64, 64, (ctx) => {
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 64, 64); ctx.fillStyle = "#1d1a17";
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const corner = (x < 3 && y < 3) || (x > 4 && y < 3) || (x < 3 && y > 4);
        if (corner ? !((x % 3 === 1 && y % 3 === 1)) : ((x * 7 + y * 13 + x * y) % 3 === 0)) ctx.fillRect(x * 8, y * 8, 8, 8);
      }
    }).tex,
  }));
  qr.position.set(lockerW / 2 - 0.2, lockerTop + 0.31, DEPTH / 2 + 0.0);
  qr.visible = false; // jen jako rezerva; displej je dostatečný

  /* ---------- Buňky + dvířka ---------- */
  const cells = [];
  const doorMeshes = [];
  const DW = CW - 0.02, DH = CH - 0.02, DT = 0.05;
  const names = ["A", "B", "C"];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      const cx = (c - 1) * PX;
      const cy = BASE + T + CH / 2 + (ROWS - 1 - r) * PY;
      const isOrange = (r + c) % 2 === 0;
      const cell = {
        idx, cx, cy, name: names[r] + (c + 1),
        open: 0, openTarget: 0, hover: 0, hoverTarget: 0,
        glassMat: new THREE.MeshPhysicalMaterial({ color: 0x2b2420, transparent: true, opacity: 0.42, roughness: 0.12, metalness: 0, emissive: 0xff7a1a, emissiveIntensity: 0 }),
        ledMat: new THREE.MeshBasicMaterial({ color: 0x2ecc71, toneMapped: false }),
        coilMat: new THREE.MeshStandardMaterial({ color: 0x3a2a22, emissive: 0xff5a10, emissiveIntensity: 0, roughness: 0.6 }),
      };

      // topné těleso na stropě buňky
      const coil = box(CW - 0.3, 0.025, 0.45, cell.coilMat);
      coil.castShadow = false;
      coil.position.set(cx, cy + CH / 2 - 0.03, 0.08);
      locker.add(coil);

      // dvířka (pivot na levé hraně)
      const pivot = new THREE.Group();
      pivot.position.set(cx - DW / 2, cy, FRONT + 0.005);
      const frameMat = isOrange ? mOrange : mCream;
      const parts = [
        [DW, 0.1, DT, DW / 2, DH / 2 - 0.05],
        [DW, 0.2, DT, DW / 2, -DH / 2 + 0.1],
        [0.1, DH - 0.3, DT, 0.05, 0.05],
        [0.1, DH - 0.3, DT, DW - 0.05, 0.05],
      ];
      parts.forEach(([w, h, d, x, y]) => {
        const m = box(w, h, d, frameMat);
        m.position.set(x, y, DT / 2);
        pivot.add(m); doorMeshes.push(m); m.userData.cell = idx;
      });
      const glass = new THREE.Mesh(new THREE.BoxGeometry(DW - 0.2, DH - 0.3, 0.02), cell.glassMat);
      glass.position.set(DW / 2, 0.05, DT / 2);
      pivot.add(glass); doorMeshes.push(glass); glass.userData.cell = idx;
      const handle = box(0.035, 0.24, 0.045, mHandle);
      handle.position.set(DW - 0.05, 0.05, DT + 0.02);
      pivot.add(handle);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.028, 0.008), cell.ledMat);
      led.position.set(DW / 2 + 0.16, -DH / 2 + 0.065, DT + 0.004);
      pivot.add(led);
      const label = canvasTexture(128, 64, (ctx, w, h) => {
        ctx.fillStyle = "#1d1a17"; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#fff"; ctx.font = "700 40px Outfit, Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(cell.name, w / 2, h / 2 + 2);
      });
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshBasicMaterial({ map: label.tex, toneMapped: false }));
      plate.position.set(0.17, -DH / 2 + 0.1, DT + 0.003);
      pivot.add(plate);

      locker.add(pivot);
      cell.pivot = pivot;
      cells.push(cell);
    }
  }

  /* ---------- Jídlo ---------- */
  const foodRoot = new THREE.Group();
  const tray = new THREE.Group();
  foodRoot.add(tray);
  scene.add(foodRoot);
  foodRoot.visible = false;

  const mContainer = new THREE.MeshStandardMaterial({ color: 0xf6f1ea, roughness: 0.35 });
  const mLid = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.05 });
  const containerBody = new THREE.Mesh(roundedBox(0.84, 0.17, 0.6, 0.07, 0.015), mContainer);
  containerBody.castShadow = true; containerBody.receiveShadow = true;
  tray.add(containerBody);
  const lid = new THREE.Mesh(roundedBox(0.88, 0.1, 0.64, 0.08, 0.012), mLid);
  lid.position.y = 0.2;
  tray.add(lid);

  const foodMats = {
    main: new THREE.MeshStandardMaterial({ color: 0xc98a4b, roughness: 0.7 }),
    side: new THREE.MeshStandardMaterial({ color: 0xf3e3a8, roughness: 0.8 }),
    veg: new THREE.MeshStandardMaterial({ color: 0x3fae5a, roughness: 0.7 }),
  };
  const mainFood = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), foodMats.main);
  mainFood.scale.set(1.05, 0.5, 1.2); mainFood.position.set(-0.17, 0.1, 0);
  mainFood.castShadow = true; tray.add(mainFood);
  const sideGeo = new THREE.SphereGeometry(0.05, 10, 8);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(sideGeo, foodMats.side);
    m.position.set(0.17 + Math.cos(i * 2.4) * 0.1 * Math.sqrt((i + 1) / 14), 0.1 + (i % 3) * 0.015, 0.14 + Math.sin(i * 2.4) * 0.09 * Math.sqrt((i + 1) / 14));
    tray.add(m);
  }
  const vegGeo = new THREE.IcosahedronGeometry(0.065, 1);
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(vegGeo, foodMats.veg);
    m.position.set(0.12 + i * 0.07, 0.115, -0.15 + (i % 2) * 0.06);
    m.rotation.set(i, i * 2, 0);
    tray.add(m);
  }

  const MEALS = {
    classic: { main: 0xc98a4b, side: 0xf3e3a8, veg: 0x6aa84f, text: "Kuřecí na paprice s bulgurem · 620 kcal · 34 g bílkovin" },
    fit: { main: 0x8a5a3b, side: 0xe9dcc4, veg: 0x2f9e44, text: "Krůtí steak, quinoa a brokolice · 650 kcal · 48 g bílkovin" },
    light: { main: 0xf08c75, side: 0xf6f0d8, veg: 0x3fae5a, text: "Pečený losos a zelenina · 430 kcal · 31 g bílkovin" },
    vege: { main: 0xe8b23a, side: 0xfbf3cf, veg: 0x2ecc71, text: "Cizrnové kari s basmati · 560 kcal · 22 g bílkovin" },
  };
  function setMeal(key) {
    const m = MEALS[key];
    foodMats.main.color.setHex(m.main); foodMats.side.color.setHex(m.side); foodMats.veg.color.setHex(m.veg);
    $("#meal-info").textContent = m.text;
    $$(".meal").forEach((b) => { const on = b.dataset.meal === key; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", String(on)); });
  }

  /* ---------- Pára a prach ---------- */
  const steamTex = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(0.5, "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }).tex;
  const steam = [];
  for (let i = 0; i < 70; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, opacity: 0, depthWrite: false, color: 0xfff6ec }));
    s.visible = false; s.userData = { age: 0, life: 1, vx: 0, vz: 0, vy: 0, size: 0.3, rot: 0 };
    scene.add(s); steam.push(s);
  }
  let steamCursor = 0;
  function emitSteam(x, y, z, n, spread) {
    for (let i = 0; i < n; i++) {
      const s = steam[steamCursor++ % steam.length];
      const u = s.userData;
      u.age = 0; u.life = 1.8 + Math.random() * 1.4;
      u.vy = 0.35 + Math.random() * 0.35; u.vx = (Math.random() - 0.5) * 0.18; u.vz = 0.05 + Math.random() * 0.2;
      u.size = 0.22 + Math.random() * 0.22; u.rot = Math.random() * 6;
      s.position.set(x + (Math.random() - 0.5) * spread, y, z + (Math.random() - 0.5) * 0.3);
      s.visible = true;
    }
  }
  function updateSteam(dt) {
    steam.forEach((s) => {
      if (!s.visible) return;
      const u = s.userData;
      u.age += dt;
      if (u.age >= u.life) { s.visible = false; return; }
      const p = u.age / u.life;
      s.position.x += u.vx * dt + Math.sin(u.age * 2 + u.rot) * 0.08 * dt;
      s.position.y += u.vy * dt;
      s.position.z += u.vz * dt;
      const sz = u.size * (1 + p * 2.6);
      s.scale.set(sz, sz, 1);
      s.material.opacity = Math.sin(Math.PI * p) * 0.42;
      s.material.rotation = u.rot + p;
    });
  }

  const DUST = 140;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 12; dustPos[i * 3 + 1] = Math.random() * 6; dustPos[i * 3 + 2] = (Math.random() - 0.5) * 8 + 1;
    dustSeed[i] = Math.random() * 10;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xe67e22, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false, map: steamTex, sizeAttenuation: true }));
  scene.add(dust);

  // konfety při vyzvednutí
  const confetti = [];
  const confGeo = new THREE.PlaneGeometry(0.06, 0.1);
  const confColors = [0xe67e22, 0x2ecc71, 0xffd166, 0xffffff];
  for (let i = 0; i < 50; i++) {
    const m = new THREE.Mesh(confGeo, new THREE.MeshBasicMaterial({ color: confColors[i % 4], side: THREE.DoubleSide, transparent: true }));
    m.visible = false; m.userData = { v: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0 };
    scene.add(m); confetti.push(m);
  }
  function burstConfetti(origin) {
    confetti.forEach((m) => {
      m.visible = true; m.position.copy(origin);
      m.userData.v.set((Math.random() - 0.5) * 3.2, 2 + Math.random() * 2.5, (Math.random() - 0.2) * 3);
      m.userData.spin.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      m.userData.life = 1.6 + Math.random() * 0.8; m.material.opacity = 1;
    });
  }
  function updateConfetti(dt) {
    confetti.forEach((m) => {
      if (!m.visible) return;
      const u = m.userData;
      u.life -= dt;
      if (u.life <= 0) { m.visible = false; return; }
      u.v.y -= 6 * dt;
      m.position.addScaledVector(u.v, dt);
      m.rotation.x += u.spin.x * dt; m.rotation.y += u.spin.y * dt; m.rotation.z += u.spin.z * dt;
      m.material.opacity = Math.min(1, u.life);
    });
  }

  /* ---------- Kamera ---------- */
  const cam = { yaw: 0.38, pitch: 0.17, dist: 11, tx: 0, ty: 2.0, tz: 0 };
  const camGoal = { yaw: 0.38, pitch: 0.17, dist: 11, tx: 0, ty: 2.0, tz: 0 };
  let dragYaw = 0, dragPitch = 0, parX = 0, parY = 0, parXs = 0, parYs = 0;
  function frameOverview() {
    const aspect = camera.aspect;
    const dist = aspect < 0.8 ? 17.5 : aspect < 1.2 ? 14 : 11.5;
    Object.assign(camGoal, { yaw: 0.38, pitch: 0.17, dist, tx: 0, ty: aspect < 0.8 ? 2.5 : 2.1, tz: 0 });
  }
  function frameCell(cell) {
    const aspect = camera.aspect;
    Object.assign(camGoal, { yaw: 0.22, pitch: 0.1, dist: aspect < 0.8 ? 7.2 : 4.8, tx: cell.cx * 0.9, ty: cell.cy + (aspect < 0.8 ? -0.1 : 0.05), tz: 0.4 });
    if (aspect >= 0.8 && aspect < 1.5) camGoal.tx += 0.6; // uvolni místo panelu
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (state === "idle") frameOverview(); else if (selected >= 0) frameCell(cells[selected]);
  }

  /* ---------- Stav aplikace ---------- */
  let state = "idle";
  let selected = -1;
  let heat = 0;            // 0..1 (ohřev)
  let heatTime = 0;
  let trayOut = 0;
  let fly = -1;            // 0..1 animace vyzvednutí
  let code = "";
  let typed = "";
  let steamAcc = 0;
  const HEAT_SECONDS = reduceMotion ? 1.5 : 4.5;

  const stepOrder = ["idle", "pick", "heat", "ready", "open"];
  function setState(next) {
    state = next;
    document.body.dataset.state = next;
    $$(".view").forEach((v) => { v.hidden = v.dataset.view !== next; });
    const idx = stepOrder.indexOf(next === "done" ? "open" : next);
    $$(".steps li").forEach((li) => {
      const i = stepOrder.indexOf(li.dataset.step);
      li.classList.toggle("is-active", i === idx && next !== "done");
      li.classList.toggle("is-done", i < idx || next === "done");
    });
    $$("[data-cell-name]").forEach((n) => { n.textContent = selected >= 0 ? cells[selected].name : ""; });

    const name = selected >= 0 ? cells[selected].name : "";
    if (next === "idle") drawDisplay("Vyber si box", "Klikni na dvířka", "#ffffff");
    if (next === "pick") drawDisplay("Box " + name, "Čeká na objednávku", "#ffd9b0");
    if (next === "heat") drawDisplay("Ohřívám…", "Box " + name, "#ff9a4d");
    if (next === "ready") drawDisplay("Hotovo · zadej kód", "Box " + name, "#2ecc71");
    if (next === "open") drawDisplay("Dvířka otevřena", "Box " + name, "#ffffff");
    if (next === "done") drawDisplay("Dobrou chuť!", "Děkujeme · BoxTeplo", "#2ecc71");
    $("#hint").classList.toggle("is-hidden", next !== "idle");
  }

  function select(i) {
    if (state !== "idle" && state !== "pick") return;
    if (selected >= 0 && selected !== i) cells[selected].openTarget = 0;
    selected = i;
    const c = cells[i];
    foodRoot.visible = true;
    tray.rotation.set(0, 0, 0);
    foodRoot.scale.setScalar(1);
    trayOut = 0; fly = -1;
    c.openTarget = 0;
    frameCell(c);
    setState("pick");
  }

  function startHeat() {
    if (state !== "pick") return;
    heatTime = 0; heat = 0;
    code = String(Math.floor(1000 + Math.random() * 9000));
    typed = ""; renderCode();
    $("#code-hint").textContent = code.split("").join(" ");
    setState("heat");
  }

  function renderCode() {
    $$("#code-display span").forEach((s, i) => { s.textContent = typed[i] ? "•" : ""; s.classList.toggle("on", i === typed.length); });
  }
  function tryUnlock() {
    if (state !== "ready") return;
    if (typed === code) {
      $("#code-error").hidden = true;
      cells[selected].openTarget = 1;
      setState("open");
      const c = cells[selected];
      emitSteam(c.cx, c.cy - 0.1, FRONT + 0.1, 22, 0.7);
      frameCell(c);
      camGoal.dist -= 0.6;
    } else {
      const d = $("#code-display");
      d.classList.remove("shake"); void d.offsetWidth; d.classList.add("shake");
      $("#code-error").hidden = false;
      typed = ""; renderCode();
    }
  }
  function pressKey(k) {
    if (state !== "ready") return;
    $("#code-error").hidden = true;
    if (k === "del") typed = typed.slice(0, -1);
    else if (k === "ok") return tryUnlock();
    else if (typed.length < 4) typed += k;
    renderCode();
    if (typed.length === 4 && k !== "del") setTimeout(tryUnlock, 180);
  }

  function take() {
    if (state !== "open") return;
    fly = 0;
    $("#btn-take").disabled = true;
  }
  function finishTake() {
    foodRoot.visible = false; fly = -1;
    const c = cells[selected];
    c.openTarget = 0;
    burstConfetti(new THREE.Vector3(c.cx, c.cy, FRONT + 0.6));
    setState("done");
    $("#btn-take").disabled = false;
  }
  function reset() {
    if (selected >= 0) { cells[selected].openTarget = 0; cells[selected].hoverTarget = 0; }
    selected = -1; heat = 0; typed = ""; trayOut = 0;
    foodRoot.visible = false;
    frameOverview();
    setState("idle");
  }
  function cancelPick() { if (selected >= 0) cells[selected].openTarget = 0; selected = -1; foodRoot.visible = false; frameOverview(); setState("idle"); }

  /* ---------- Ovládání (UI) ---------- */
  $$(".meal").forEach((b) => b.addEventListener("click", () => setMeal(b.dataset.meal)));
  $("#btn-heat").addEventListener("click", startHeat);
  $("#btn-cancel").addEventListener("click", cancelPick);
  $("#btn-take").addEventListener("click", take);
  $("#btn-again").addEventListener("click", reset);
  $("#keypad").addEventListener("click", (e) => { const b = e.target.closest("button[data-k]"); if (b) pressKey(b.dataset.k); });
  $("#code-hint").addEventListener("click", () => {
    if (state !== "ready") return;
    typed = ""; renderCode();
    code.split("").forEach((d, i) => setTimeout(() => pressKey(d), i * 140));
  });
  document.addEventListener("keydown", (e) => {
    if (state === "ready") {
      if (/^[0-9]$/.test(e.key)) pressKey(e.key);
      else if (e.key === "Backspace") pressKey("del");
      else if (e.key === "Enter") pressKey("ok");
    }
    if (e.key === "Escape" && state === "pick") cancelPick();
  });

  /* ---------- Ukazatel a přetahování ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = -1;
  let down = null;

  function setNdc(e) {
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  }
  function pick() {
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(doorMeshes, false)[0];
    return hit ? hit.object.userData.cell : -1;
  }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    down = { x: e.clientX, y: e.clientY, yaw: dragYaw, pitch: dragPitch, moved: false };
    canvas.classList.add("is-dragging");
  });
  canvas.addEventListener("pointermove", (e) => {
    parX = (e.clientX / window.innerWidth - 0.5) * 2;
    parY = (e.clientY / window.innerHeight - 0.5) * 2;
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) down.moved = true;
      if (down.moved) {
        dragYaw = clamp(down.yaw - dx * 0.006, -0.9, 0.9);
        dragPitch = clamp(down.pitch + dy * 0.004, -0.12, 0.35);
      }
    } else if (e.pointerType === "mouse") {
      setNdc(e);
      hovered = pick();
      canvas.classList.toggle("is-pointer", hovered >= 0 && (state === "idle" || state === "pick"));
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    canvas.classList.remove("is-dragging");
    if (down && !down.moved) {
      setNdc(e);
      const i = pick();
      if (i >= 0) select(i);
    }
    down = null;
  });
  canvas.addEventListener("pointerleave", () => { hovered = -1; canvas.classList.remove("is-pointer"); });

  /* ---------- Hlavní smyčka ---------- */
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  let time = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;

    // ohřev
    if (state === "heat") {
      heatTime += dt;
      heat = clamp(heatTime / HEAT_SECONDS, 0, 1);
      const eased = easeInOut(heat);
      $("#temp").textContent = String(Math.round(6 + 62 * eased));
      $("#bar-fill").style.width = Math.round(eased * 100) + "%";
      $("#bar").setAttribute("aria-valuenow", String(Math.round(eased * 100)));
      steamAcc += dt * (heat > 0.35 ? 8 * heat : 0);
      if (selected >= 0 && steamAcc > 1) {
        const c = cells[selected];
        emitSteam(c.cx, c.cy + CH / 2 + 0.1, FRONT - 0.1, 1, 0.9);
        steamAcc = 0;
      }
      if (heat >= 1) setState("ready");
    }

    // buňky
    cells.forEach((c) => {
      const isSel = c.idx === selected;
      c.hoverTarget = !isSel && c.idx === hovered && (state === "idle" || state === "pick") && !down ? 1 : 0;
      c.hover = damp(c.hover, c.hoverTarget, 10, dt);
      c.open = damp(c.open, c.openTarget, 4.5, dt);
      c.pivot.rotation.y = -(c.open * 1.95 + c.hover * 0.16);

      // LED + žhavení
      const h = isSel ? (state === "heat" ? easeInOut(heat) : state === "pick" ? 0 : 1) : 0;
      c.glassMat.emissiveIntensity = damp(c.glassMat.emissiveIntensity, h * (state === "ready" || state === "open" ? 0.55 : 0.7), 6, dt);
      c.coilMat.emissiveIntensity = damp(c.coilMat.emissiveIntensity, isSel && (state === "heat" || state === "ready") ? 0.4 + h * 2.4 : 0, 6, dt);
      if (isSel && state === "heat") c.ledMat.color.setHex(0xe67e22).multiplyScalar(0.6 + 0.4 * Math.sin(time * 9));
      else if (isSel && (state === "ready" || state === "open")) c.ledMat.color.setHex(0x2ecc71).multiplyScalar(1 + 0.3 * Math.sin(time * 5));
      else if (isSel) c.ledMat.color.setHex(0xe67e22);
      else c.ledMat.color.setHex(0x2ecc71).multiplyScalar(0.55 + 0.1 * Math.sin(time * 1.5 + c.idx));
    });

    // světlo uvnitř vybraného boxu
    if (selected >= 0) {
      const c = cells[selected];
      heatLight.position.set(c.cx, c.cy + 0.25, 0.1);
      const target = state === "heat" ? easeInOut(heat) * 3.2 : state === "ready" || state === "open" ? 2.4 : 0;
      heatLight.intensity = damp(heatLight.intensity, target + (state === "heat" ? Math.sin(time * 11) * 0.1 : 0), 6, dt);
    } else {
      heatLight.intensity = damp(heatLight.intensity, 0, 6, dt);
    }

    // jídlo
    if (foodRoot.visible && selected >= 0) {
      const c = cells[selected];
      trayOut = damp(trayOut, state === "open" ? 1 : 0, 3.5, dt);
      const baseY = c.cy - CH / 2 + 0.14;
      foodRoot.position.set(c.cx, baseY + Math.sin(time * 1.6) * 0.0, trayOut * 0.62);
      foodRoot.position.z += 0.0;
      if (state === "open" && fly < 0) {
        foodRoot.position.y += Math.sin(time * 2) * 0.012 + 0.012 * trayOut;
        if (Math.random() < dt * 5) emitSteam(c.cx - 0.1, c.cy - 0.2, 0.55 + trayOut * 0.3, 1, 0.4);
      }
      if (fly >= 0) {
        fly += dt / 1.1;
        const p = clamp(fly, 0, 1);
        const e = easeIn(p);
        tmp.copy(camera.position).sub(foodRoot.position);
        foodRoot.position.addScaledVector(tmp, e * 0.8);
        foodRoot.position.y += Math.sin(p * Math.PI) * 0.5;
        foodRoot.rotation.y = p * Math.PI * 1.5;
        foodRoot.rotation.x = Math.sin(p * Math.PI) * 0.3;
        foodRoot.scale.setScalar(1 - e * 0.55);
        if (fly >= 1.02) { foodRoot.rotation.set(0, 0, 0); finishTake(); }
      }
    }

    // kamera
    parXs = damp(parXs, parX, 3, dt); parYs = damp(parYs, parY, 3, dt);
    ["yaw", "pitch", "dist", "tx", "ty", "tz"].forEach((k) => { cam[k] = damp(cam[k], camGoal[k], 3.2, dt); });
    const yaw = cam.yaw + dragYaw + parXs * 0.05 + (reduceMotion ? 0 : Math.sin(time * 0.3) * 0.015);
    const pitch = clamp(cam.pitch + dragPitch - parYs * 0.03, 0.0, 0.6);
    camera.position.set(
      cam.tx + Math.sin(yaw) * Math.cos(pitch) * cam.dist,
      cam.ty + Math.sin(pitch) * cam.dist,
      cam.tz + Math.cos(yaw) * Math.cos(pitch) * cam.dist
    );
    camera.lookAt(cam.tx, cam.ty, cam.tz);

    // prach
    const pa = dustGeo.attributes.position;
    for (let i = 0; i < DUST; i++) {
      let y = pa.getY(i) + dt * (0.05 + (dustSeed[i] % 1) * 0.08);
      if (y > 6) y = 0;
      pa.setY(i, y);
      pa.setX(i, pa.getX(i) + Math.sin(time * 0.4 + dustSeed[i]) * dt * 0.05);
    }
    pa.needsUpdate = true;

    updateSteam(dt);
    updateConfetti(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  /* ---------- Start ---------- */
  window.addEventListener("resize", resize);
  setMeal("classic");
  drawDisplay("Vyber si box", "Klikni na dvířka", "#ffffff");
  setState("idle");
  resize();
  Object.assign(cam, camGoal);
  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(() => drawDisplay("Vyber si box", "Klikni na dvířka", "#ffffff")).catch(() => {});
  requestAnimationFrame(frame);

  // pro ladění a automatické testy
  window.BoxTeplo3D = { select, startHeat, pressKey, take, reset, get state() { return state; }, get code() { return code; } };
})();
