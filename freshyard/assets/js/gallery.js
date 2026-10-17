/* Freshyard.cz – gallery page: 3D cylinder (desktop) / tilt grid (mobile) + lightbox */
import { ASSET_BASE, bindTilt, observeReveal } from './main.js';

const PHOTOS = [
  '20260930-210757-8cddf7d93988.jpg', '20260930-210756-0fd67a5578b9.jpg', '20260930-210755-211bea337e3f.jpg', '20260930-210754-72a6588c1b87.jpg',
  '20260930-210753-c92987668871.jpg', '20260930-205333-c42dc2fc9f6a.jpg', '20260930-205332-29e4e892268d.jpg', '20260930-205331-8c96fcca1632.jpg',
  '20260930-205330-1999dd450315.jpg', '20260930-205329-032075469136.jpg', '20260930-205328-a55661172cc0.jpg', '20260930-205326-ad34f1f14f77.jpg',
  '20260930-205325-0444bc64e73a.jpg', '20260930-205324-8e2c72dce554.jpg', '20260930-205323-bbf83f937aa2.jpg', '20260930-205322-962f72961b3a.jpg',
  '20260930-205321-61dc9cafdc45.jpg', '20260930-205320-f65bb070a722.jpg', '20260930-205319-a96a3410b21b.jpg', '20260930-205318-a5fdde180494.jpg',
  '20260930-205317-3e3ecf56a1bb.jpg', '20260930-205317-7619c5ba574f.jpg', '20260930-205316-a49beeab5f52.jpg', '20260930-205315-5726fa3e65a6.jpg',
  '20260930-205314-028152524d8e.jpg', '20260930-205313-d65b66751487.jpg', '20260930-205312-0540f05262fd.jpg', '20260930-205311-ceb54b623f53.jpg',
  '20260930-205310-ec4d90a87bb7.jpg', '20260930-205310-d585390bf2a0.jpg', '20260930-205309-3239ae0d9e8d.jpg',
];
const thumb = (f) => `${ASSET_BASE}assets/gallery/uploads/thumbs/${f}`;
const full = (f) => `${ASSET_BASE}assets/gallery/uploads/photos/${f}`;
const ALT = 'Fotografie z realizace Freshyard.cz';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const useCylinder = !reduceMotion && matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)').matches;
document.body.classList.add(useCylinder ? 'g-mode-cyl' : 'g-mode-grid');

const msg = document.getElementById('gallery-msg');
const grid = document.getElementById('g-grid');
const cyl = document.getElementById('cyl');
const stage = document.getElementById('cyl-stage');
const wrap = document.getElementById('cyl-wrap');

if (!PHOTOS.length) {
  msg.textContent = 'Fotografie z realizací tu brzy najdete.';
  msg.hidden = false;
  wrap.remove();
} else {
  /* ---------- grid (mobile, reduced motion, and fallback) ---------- */
  let failed = 0;
  grid.innerHTML = PHOTOS.map((f, i) =>
    `<button class="g-grid__item" type="button" data-index="${i}" data-tilt data-reveal style="--i:${i % 6}" aria-label="Otevřít fotografii ${i + 1} z ${PHOTOS.length}">
       <img loading="lazy" decoding="async" src="${thumb(f)}" alt="${ALT}"><span class="glare"></span>
     </button>`).join('');
  grid.querySelectorAll('.g-grid__item').forEach((el) => { bindTilt(el, 10); observeReveal(el); });
  grid.querySelectorAll('img').forEach((img) => img.addEventListener('error', () => {
    failed++;
    if (failed === PHOTOS.length) { msg.textContent = 'Fotografie se nepodařilo načíst. Obnovte prosím stránku.'; msg.hidden = false; }
  }));

  /* ---------- 3D cylinder ---------- */
  if (useCylinder) {
    const n = PHOTOS.length;
    const itemW = 300;
    const step = 360 / n;
    const radius = Math.round((itemW + 26) / 2 / Math.tan(Math.PI / n));
    cyl.innerHTML = PHOTOS.map((f, i) =>
      `<button class="cyl__item" type="button" data-index="${i}" aria-label="Otevřít fotografii ${i + 1} z ${n}"
         style="transform: rotateY(${i * step}deg) translateZ(${radius}px)">
         <img loading="lazy" decoding="async" src="${thumb(f)}" alt="${ALT}">
       </button>`).join('');

    let scrollAngle = 0, dragAngle = 0, current = 0, velocity = 0;
    let dragging = false, lastX = 0, moved = 0;
    const tiltX = () => -6 + (wrap.getBoundingClientRect().top / innerHeight) * 4;

    const readScroll = () => {
      const r = wrap.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
      scrollAngle = -p * 360;
    };
    addEventListener('scroll', readScroll, { passive: true });
    readScroll();

    stage.addEventListener('pointerdown', (e) => {
      dragging = true; lastX = e.clientX; moved = 0; velocity = 0;
      stage.classList.add('is-dragging');
    });
    addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      moved += Math.abs(dx);
      dragAngle += dx * 0.22;
      velocity = dx * 0.22;
    });
    addEventListener('pointerup', () => { dragging = false; stage.classList.remove('is-dragging'); });
    // a click after a drag should not open the lightbox
    cyl.addEventListener('click', (e) => { if (moved > 6) { e.stopPropagation(); e.preventDefault(); } }, true);

    // keyboard: focusing an item rotates it to the front
    cyl.addEventListener('focusin', (e) => {
      const b = e.target.closest('.cyl__item');
      if (!b) return;
      const target = -Number(b.dataset.index) * step;
      // shortest path from current angle
      const diff = ((target - (scrollAngle + dragAngle)) % 360 + 540) % 360 - 180;
      dragAngle += diff;
    });

    const loop = () => {
      if (!dragging) { dragAngle += velocity; velocity *= 0.94; }
      const target = scrollAngle + dragAngle;
      current += (target - current) * 0.08;
      cyl.style.transform = `translateZ(${-radius}px) rotateX(${tiltX()}deg) rotateY(${current}deg)`;
      requestAnimationFrame(loop);
    };
    loop();
  }

  /* ---------- lightbox ---------- */
  const lb = document.getElementById('lightbox');
  const lbImg = lb.querySelector('img');
  const lbCount = lb.querySelector('.lightbox__count');
  let idx = 0, lastFocus = null;
  const show = (i) => {
    idx = (i + PHOTOS.length) % PHOTOS.length;
    lbImg.classList.add('is-loading');
    const img = new Image();
    img.onload = img.onerror = () => { lbImg.src = img.src; lbImg.classList.remove('is-loading'); };
    img.src = full(PHOTOS[idx]);
    lbCount.textContent = `${idx + 1} / ${PHOTOS.length}`;
  };
  const open = (i) => {
    lastFocus = document.activeElement;
    lb.hidden = false;
    requestAnimationFrame(() => lb.classList.add('is-open'));
    document.body.classList.add('is-locked');
    show(i);
    lb.querySelector('.lightbox__close').focus();
  };
  const close = () => {
    lb.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    setTimeout(() => (lb.hidden = true), 350);
    lastFocus?.focus({ preventScroll: true });
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-index]');
    if (b && (b.closest('#cyl') || b.closest('#g-grid'))) open(Number(b.dataset.index));
  });
  lb.querySelector('.lightbox__close').addEventListener('click', close);
  lb.querySelector('.lightbox__prev').addEventListener('click', () => show(idx - 1));
  lb.querySelector('.lightbox__next').addEventListener('click', () => show(idx + 1));
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
    if (e.key === 'Tab') {
      // keep focus inside the dialog
      const f = [...lb.querySelectorAll('button')];
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });
  let sx = 0, sy = 0;
  lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(idx + (dx < 0 ? 1 : -1));
  });
}
