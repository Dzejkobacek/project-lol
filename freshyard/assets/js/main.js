/* Freshyard.cz – shared interactions (home + gallery) */
import Lenis from './vendor/lenis.mjs';

export const ASSET_BASE = 'https://www.freshyard.cz/';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const isMobile = matchMedia('(max-width: 820px)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------------- Smooth scroll (Lenis) ---------------- */
let lenis = null;
if (!reduceMotion) {
  lenis = new Lenis({ duration: 1.1, smoothWheel: true, anchors: false });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}
export const scrollToTarget = (target) => {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  const header = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 76;
  if (lenis) lenis.scrollTo(el, { offset: el.id === 'top' ? 0 : -header - 8 });
  else el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
};

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  const el = document.querySelector(id);
  if (!el) return;
  e.preventDefault();
  closeMenu();
  scrollToTarget(el);
  try { history.replaceState(null, '', id); } catch (_) {}
  // move focus for keyboard users
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
});

/* ---------------- Loader ---------------- */
(() => {
  const loader = $('#loader');
  if (!loader) return;
  let seen = false;
  try { seen = sessionStorage.getItem('fy-loader') === '1'; } catch (_) {}
  if (seen || reduceMotion) { loader.remove(); return; }
  try { sessionStorage.setItem('fy-loader', '1'); } catch (_) {}
  const start = performance.now();
  const done = () => {
    const wait = Math.max(0, 1100 - (performance.now() - start));
    setTimeout(() => { loader.classList.add('is-done'); setTimeout(() => loader.remove(), 700); }, wait);
  };
  // never longer than ~1.7 s
  const hard = setTimeout(done, 1700);
  window.addEventListener('load', () => { clearTimeout(hard); done(); }, { once: true });
})();

/* ---------------- Header ---------------- */
const header = $('#header');
const onScrollHeader = () => header && header.classList.toggle('is-scrolled', window.scrollY > 24);
onScrollHeader();

/* Active nav link */
(() => {
  const links = $$('.nav a[href^="#"]');
  if (!links.length) return;
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        links.forEach((l) => l.classList.remove('is-active'));
        map.get(en.target.id)?.classList.add('is-active');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
})();

/* ---------------- Mobile menu ---------------- */
const burger = $('.burger');
const menu = $('#mobile-menu');
function openMenu() {
  if (!menu) return;
  menu.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
  burger.setAttribute('aria-expanded', 'true');
  burger.setAttribute('aria-label', 'Zavřít menu');
  document.body.classList.add('is-locked');
  lenis?.stop();
  setTimeout(() => menu.querySelector('a')?.focus(), 300);
}
function closeMenu() {
  if (!menu || !menu.classList.contains('is-open')) return;
  menu.classList.remove('is-open');
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('aria-label', 'Otevřít menu');
  document.body.classList.remove('is-locked');
  lenis?.start();
  setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 700);
}
burger?.addEventListener('click', () => (menu.classList.contains('is-open') ? closeMenu() : openMenu()));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menu?.classList.contains('is-open')) { closeMenu(); burger.focus(); }
});
menu?.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });

/* ---------------- Custom cursor + magnetic buttons ---------------- */
if (finePointer && !reduceMotion) {
  const ring = $('.cursor');
  const dot = $('.cursor-dot');
  if (ring && dot) {
    document.documentElement.classList.add('has-cursor');
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
    window.addEventListener('pointermove', (e) => {
      x = e.clientX; y = e.clientY;
      dot.style.transform = `translate(${x}px, ${y}px)`;
    }, { passive: true });
    const loop = () => {
      rx += (x - rx) * 0.2; ry += (y - ry) * 0.2;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(loop);
    };
    loop();
    const hoverSel = 'a, button, [data-tilt], input[type="range"], .cyl-stage';
    document.addEventListener('pointerover', (e) => { if (e.target.closest(hoverSel)) ring.classList.add('is-hover'); });
    document.addEventListener('pointerout', (e) => { if (e.target.closest(hoverSel)) ring.classList.remove('is-hover'); });
    document.addEventListener('pointerleave', () => { ring.classList.add('is-hidden'); dot.classList.add('is-hidden'); });
    document.addEventListener('pointerenter', () => { ring.classList.remove('is-hidden'); dot.classList.remove('is-hidden'); });
  }
  $$('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const mx = (e.clientX - r.left - r.width / 2) * 0.28;
      const my = (e.clientY - r.top - r.height / 2) * 0.38;
      el.style.setProperty('--mx', `${mx}px`);
      el.style.setProperty('--my', `${my}px`);
      if (!el.classList.contains('btn')) el.style.transform = `translate(${mx}px, ${my}px)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--mx', '0px');
      el.style.setProperty('--my', '0px');
      if (!el.classList.contains('btn')) el.style.transform = '';
    });
  });
}

/* ---------------- 3D tilt ---------------- */
export function bindTilt(el, max = 10) {
  if (!finePointer || reduceMotion) return;
  const media = el.querySelector('.svc__media img');
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${(px - 0.5) * max * 2}deg`);
    el.style.setProperty('--rx', `${(0.5 - py) * max * 2}deg`);
    el.style.setProperty('--gx', `${px * 100}%`);
    el.style.setProperty('--gy', `${py * 100}%`);
    if (media) {
      el.style.setProperty('--px', `${(0.5 - px) * 22}px`);
      el.style.setProperty('--py', `${(0.5 - py) * 22}px`);
    }
  });
  el.addEventListener('pointerleave', () => {
    ['--rx', '--ry'].forEach((p) => el.style.setProperty(p, '0deg'));
    ['--px', '--py'].forEach((p) => el.style.setProperty(p, '0px'));
  });
}
$$('[data-tilt]').forEach((el) => bindTilt(el, el.classList.contains('svc') ? 8 : 12));

/* ---------------- Scroll reveal ---------------- */
const revealIO = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); }
  });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
export const observeReveal = (el) => revealIO.observe(el);
$$('[data-reveal]').forEach(observeReveal);
window.fyReady = true; // tells the inline fallback in <head> that reveals are running

/* Split-text (word by word) */
$$('.split').forEach((el) => {
  const words = el.textContent.trim().split(/\s+/);
  el.setAttribute('aria-label', el.textContent.trim());
  el.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true"><span style="--wi:${i}">${w}</span></span>`).join(' ');
  observeReveal(el);
});

/* ---------------- Hero: service tags toggle ---------------- */
(() => {
  const btn = $('.tag-toggle');
  if (!btn) return;
  const wrap = $('#' + btn.getAttribute('aria-controls'));
  const list = $('.tags--more', wrap);
  const label = $('span', btn);
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    label.textContent = open ? btn.dataset.open : btn.dataset.closed;
    wrap.classList.toggle('is-open', open);
    list.classList.toggle('is-open', open);
  });
})();

/* ---------------- Hero 3D (lazy, after first paint) ---------------- */
let heroProgress = 0;
(() => {
  const host = $('#hero-canvas');
  if (!host) return;
  const supportsWebGL = (() => {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (_) { return false; }
  })();
  const lowEnd = (navigator.hardwareConcurrency || 4) <= 2 || (navigator.deviceMemory && navigator.deviceMemory <= 2) || navigator.connection?.saveData;
  if (reduceMotion || !supportsWebGL || lowEnd) { document.documentElement.classList.add('no-webgl'); return; }
  const start = () => import('./hero3d.js')
    .then((m) => m.initHero(host, { getProgress: () => heroProgress, mobile: isMobile }))
    .then(() => host.classList.add('is-ready'))
    .catch(() => document.documentElement.classList.add('no-webgl'));
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
  if (document.readyState === 'complete') idle(start, { timeout: 1200 });
  else window.addEventListener('load', () => idle(start, { timeout: 1200 }), { once: true });
})();

/* ---------------- Scroll-driven effects (one rAF loop) ---------------- */
const heroWrap = $('.hero-wrap');
const videoFrame = $('#video-frame');
const videoBgs = $$('.video__bg');
const videoSection = $('#video');
const aboutMedia = $('#about-media');
const aboutImg = aboutMedia?.querySelector('img');
const stackCards = $$('.stack-card');
const stickyCta = $('#sticky-cta');
const heroBg = $('.hero__bg');

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const vh = innerHeight;
    onScrollHeader();

    if (heroWrap) {
      const r = heroWrap.getBoundingClientRect();
      // on mobile the hero is not pinned, so the trim still needs some scroll distance
      const total = Math.max(r.height - vh, vh * 0.6);
      heroProgress = clamp(-r.top / total, 0, 1);
      if (heroBg && !reduceMotion) heroBg.style.transform = `scale(${1.08 + heroProgress * 0.08}) translateY(${heroProgress * 30}px)`;
    }
    if (reduceMotion) { stickyCta?.classList.toggle('is-visible', window.scrollY > vh * 0.6); return; }

    if (videoFrame) {
      const r = videoFrame.getBoundingClientRect();
      const center = r.top + r.height / 2;
      // 1 when the frame enters from below, 0 when it reaches ~55 % of the viewport
      const t = clamp((center - vh * 0.5) / (vh * 0.55), 0, 1);
      videoFrame.style.setProperty('--tilt', t.toFixed(3));
    }
    if (videoSection && videoBgs.length) {
      const r = videoSection.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        const p = (r.top + r.height / 2 - vh / 2) / vh;
        videoBgs.forEach((b) => b.style.setProperty('--py', `${p * 70}px`));
      }
    }
    if (aboutImg) {
      const r = aboutMedia.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        const p = (r.top + r.height / 2 - vh / 2) / vh;
        aboutImg.style.setProperty('--py', `${p * -60}px`);
      }
    }
    if (stackCards.length) {
      stackCards.forEach((card, i) => {
        const next = stackCards[i + 1];
        if (!next) { card.style.setProperty('--s', 1); return; }
        const a = card.getBoundingClientRect();
        const b = next.getBoundingClientRect();
        // shrink the card as the next one slides over it
        const overlap = clamp((a.bottom - b.top) / a.height, 0, 1);
        card.style.setProperty('--s', (1 - overlap * 0.06).toFixed(4));
        card.style.filter = `brightness(${1 - overlap * 0.35})`;
      });
    }
    stickyCta?.classList.toggle('is-visible', window.scrollY > vh * 0.6 && !isNearContact());
  });
}
const contactEl = $('#kontakt');
function isNearContact() {
  if (!contactEl) return false;
  const r = contactEl.getBoundingClientRect();
  return r.top < innerHeight * 0.6 && r.bottom > 0;
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

/* ---------------- Video carousel ---------------- */
(() => {
  const frame = $('#video-frame');
  if (!frame) return;
  const videos = $$('video', frame);
  const slides = $$('.video__slide');
  const dots = $$('.dots .dot');
  const count = $('[data-video-count]');
  let idx = 0;
  const go = (n) => {
    const prev = idx;
    idx = (n + videos.length) % videos.length;
    if (prev === idx) return;
    videos[prev].pause();
    frame.classList.remove('has-error');
    videos.forEach((v, i) => v.classList.toggle('is-active', i === idx));
    slides.forEach((s, i) => { s.classList.toggle('is-active', i === idx); s.setAttribute('aria-hidden', String(i !== idx)); });
    dots.forEach((d, i) => d.setAttribute('aria-current', String(i === idx)));
    videoBgs.forEach((b, i) => b.classList.toggle('is-active', i === idx));
    count.textContent = `Video ${idx + 1} ze ${videos.length}`;
  };
  $('[data-video-prev]').addEventListener('click', () => go(idx - 1));
  $('[data-video-next]').addEventListener('click', () => go(idx + 1));
  dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
  const section = $('#video');
  let inView = false;
  new IntersectionObserver(([en]) => {
    inView = en.isIntersecting;
    if (!inView) videos[idx].pause();
  }, { threshold: 0.35 }).observe(section);
  document.addEventListener('keydown', (e) => {
    if (!inView || e.target.closest('input, textarea, video')) return;
    if (e.key === 'ArrowLeft') go(idx - 1);
    if (e.key === 'ArrowRight') go(idx + 1);
  });
  videos.forEach((v) => {
    const onErr = () => { if (v.classList.contains('is-active')) frame.classList.add('has-error'); };
    v.addEventListener('error', onErr);
    v.querySelector('source')?.addEventListener('error', onErr);
  });
  $('[data-video-reload]')?.addEventListener('click', () => {
    frame.classList.remove('has-error');
    videos[idx].load();
    videos[idx].play().catch(() => {});
  });
})();

/* ---------------- Before / after slider ---------------- */
(() => {
  const ba = $('#ba');
  if (!ba) return;
  const range = $('.ba__range', ba);
  const set = (v) => { ba.style.setProperty('--pos', `${v}%`); range.value = v; };
  range.addEventListener('input', () => set(range.value));
  let dragging = false;
  const fromEvent = (e) => {
    const r = ba.getBoundingClientRect();
    set(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100).toFixed(1));
  };
  ba.addEventListener('pointerdown', (e) => { dragging = true; ba.classList.add('is-dragging'); ba.setPointerCapture(e.pointerId); fromEvent(e); });
  ba.addEventListener('pointermove', (e) => { if (dragging) fromEvent(e); });
  const end = () => { dragging = false; ba.classList.remove('is-dragging'); };
  ba.addEventListener('pointerup', end);
  ba.addEventListener('pointercancel', end);
  // short intro sweep when visible
  if (!reduceMotion) {
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const anim = (t) => {
        if (dragging) return;
        const p = Math.min(1, (t - t0) / 1800);
        set((50 + Math.sin(p * Math.PI * 2) * 22 * (1 - p)).toFixed(1));
        if (p < 1) requestAnimationFrame(anim);
      };
      requestAnimationFrame(anim);
    }, { threshold: 0.5 });
    io.observe(ba);
  }
})();

/* ---------------- Photo strip ---------------- */
(() => {
  const track = $('#strip-track');
  if (!track) return;
  const picks = [
    '20260930-210757-8cddf7d93988.jpg', '20260930-205333-c42dc2fc9f6a.jpg', '20260930-205329-032075469136.jpg', '20260930-205324-8e2c72dce554.jpg',
    '20260930-205320-f65bb070a722.jpg', '20260930-205316-a49beeab5f52.jpg', '20260930-205312-0540f05262fd.jpg', '20260930-205309-3239ae0d9e8d.jpg',
  ];
  const html = picks.map((f) => `<figure><img loading="lazy" decoding="async" src="${ASSET_BASE}assets/gallery/uploads/thumbs/${f}" alt="Fotografie z realizace Freshyard.cz"></figure>`).join('');
  track.innerHTML = html + html;
})();

/* ---------------- Instagram embeds (lazy) ---------------- */
(() => {
  const grid = $('#insta-grid');
  if (!grid) return;
  const io = new IntersectionObserver(([en]) => {
    if (!en.isIntersecting) return;
    io.disconnect();
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.instagram.com/embed.js';
    s.onload = () => window.instgrm?.Embeds?.process();
    document.body.appendChild(s);
  }, { rootMargin: '400px' });
  io.observe(grid);
})();

/* ---------------- Partner ring carousel ---------------- */
(() => {
  const ring = $('#ring');
  if (!ring) return;
  const stage = $('#ring-stage');
  const items = $$('.ring__item', ring);
  const n = items.length;
  let step = 0; // unbounded, so rotation always continues in one direction
  const update = () => {
    ring.style.setProperty('--ry', `${-step * (360 / n)}deg`);
    const front = ((step % n) + n) % n;
    items.forEach((it, i) => {
      it.classList.toggle('is-front', i === front);
      it.classList.toggle('is-back', i !== front);
      it.setAttribute('aria-hidden', String(i !== front));
    });
  };
  update();
  let timer = null;
  let paused = false;
  const play = () => { clearInterval(timer); if (!reduceMotion) timer = setInterval(() => { if (!paused) { step++; update(); } }, 4200); };
  $('[data-ring-prev]').addEventListener('click', () => { step--; update(); play(); });
  $('[data-ring-next]').addEventListener('click', () => { step++; update(); play(); });
  stage.addEventListener('pointerenter', () => (paused = true));
  stage.addEventListener('pointerleave', () => (paused = false));
  stage.addEventListener('focusin', () => (paused = true));
  stage.addEventListener('focusout', () => (paused = false));
  new IntersectionObserver(([en]) => (en.isIntersecting ? play() : clearInterval(timer))).observe(stage);
})();

/* ---------------- FAQ accordion ---------------- */
$$('.faq-q').forEach((btn) => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    item.classList.toggle('is-open', open);
  });
});

/* ---------------- Contact form ---------------- */
(() => {
  const form = $('#contact-form');
  if (!form) return;
  const status = $('.form__status', form);
  const btn = $('button[type="submit"]', form);
  const setStatus = (text, cls) => { status.textContent = text; status.className = 'form__status' + (cls ? ' ' + cls : ''); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      const bad = form.querySelector(':invalid');
      bad?.focus();
      form.reportValidity();
      return;
    }
    btn.disabled = true;
    setStatus('Odesílám poptávku...');
    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      let ok = res.ok;
      try { const data = await res.clone().json(); if (data && data.ok === false) ok = false; } catch (_) {}
      if (!ok) throw new Error('bad response');
      setStatus('Děkujeme, poptávka byla odeslána. Brzy se ozveme.', 'is-ok');
      form.reset();
      if (!reduceMotion) {
        const leaf = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        leaf.setAttribute('class', 'fly-leaf');
        leaf.setAttribute('aria-hidden', 'true');
        leaf.innerHTML = '<use href="#i-leaf"/>';
        $('.form__foot', form).appendChild(leaf);
        setTimeout(() => leaf.remove(), 1700);
      }
    } catch (_) {
      setStatus('Poptávku se nepodařilo odeslat.', 'is-err');
    } finally {
      btn.disabled = false;
    }
  });
})();

/* ---------------- Cookie consent + Google Analytics ---------------- */
(() => {
  const banner = $('#cookie');
  if (!banner) return;
  const KEY = 'fy-analytics-consent';
  const GA_ID = document.documentElement.dataset.gaId || window.FRESHYARD_GA_ID || '';
  const get = () => { try { return localStorage.getItem(KEY); } catch (_) { return null; } };
  const store = (v) => { try { localStorage.setItem(KEY, v); } catch (_) {} };
  const loadGA = () => {
    if (!GA_ID || window.gtag) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
  };
  const show = () => { banner.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('is-visible'))); };
  const hide = () => { banner.classList.remove('is-visible'); setTimeout(() => (banner.hidden = true), 700); };
  const state = get();
  if (state === 'accepted') loadGA();
  else if (!state) setTimeout(show, 2200);
  banner.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cookie]');
    if (!b) return;
    const v = b.dataset.cookie === 'accept' ? 'accepted' : 'denied';
    store(v);
    if (v === 'accepted') loadGA();
    hide();
  });
  $$('[data-cookie-open]').forEach((b) => b.addEventListener('click', show));
})();
