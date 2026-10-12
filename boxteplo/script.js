/* =========================================================
   BoxTeplo – interakce (čistý JavaScript)
   ========================================================= */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ---------- Header: stín při scrollu ---------- */
  const header = $(".site-header");
  const mobileCta = $(".mobile-cta");
  const hero = $(".hero");
  const order = $("#objednavka");

  function onScroll() {
    const y = window.scrollY;
    header.classList.toggle("is-scrolled", y > 8);

    // Mobilní CTA ukaž po hero sekci, schovej u objednávky
    const heroBottom = hero.offsetTop + hero.offsetHeight;
    const orderTop = order.getBoundingClientRect().top;
    const show = y > heroBottom - 200 && orderTop > window.innerHeight;
    mobileCta.classList.toggle("is-visible", show);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobilní menu ---------- */
  const toggle = $(".nav-toggle");
  const nav = $("#main-nav");

  function setMenu(open) {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Zavřít menu" : "Otevřít menu");
    nav.classList.toggle("is-open", open);
  }
  toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  $$("a", nav).forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  document.addEventListener("click", (e) => {
    if (nav.classList.contains("is-open") && !nav.contains(e.target) && !toggle.contains(e.target)) setMenu(false);
  });

  /* ---------- Aktivní položka navigace ---------- */
  const navLinks = $$('.main-nav a[href^="#"]:not(.btn)');
  const sections = navLinks.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === "#" + entry.target.id));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- Reveal animace ---------- */
  const reveals = $$(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const siblings = Array.from(el.parentElement.children);
        el.style.transitionDelay = Math.min(siblings.indexOf(el), 4) * 80 + "ms";
        el.classList.add("is-visible");
        // po dokončení odeber zpoždění, ať hover reaguje okamžitě
        setTimeout(() => { el.style.transitionDelay = ""; }, 1100);
        io.unobserve(el);
      });
    }, { threshold: 0.12 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------- Fallback obrázků ---------- */
  const hideImg = (img) => { img.style.visibility = "hidden"; };
  $$("img").forEach((img) => {
    if (img.complete && img.naturalWidth === 0) hideImg(img);
    else img.addEventListener("error", () => hideImg(img), { once: true });
  });

  /* ---------- Pomocník pro skupiny chipů ---------- */
  function chipGroup(buttons, attr, onChange) {
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => {
          const active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-pressed", String(active));
        });
        onChange(btn.dataset[attr]);
      });
    });
  }

  /* ---------- Filtr dnešní nabídky ---------- */
  const dishes = $$("#dish-grid .dish");
  const dishEmpty = $(".filter-empty");
  chipGroup($$(".filters .chip"), "filter", (filter) => {
    let visible = 0;
    dishes.forEach((d) => {
      const match = filter === "all" || d.dataset.cat.split(" ").includes(filter);
      d.classList.toggle("is-hidden", !match);
      d.classList.remove("is-entering");
      if (match) {
        void d.offsetWidth; // restart animace
        d.classList.add("is-entering");
        visible++;
      }
    });
    dishEmpty.hidden = visible > 0;
  });

  /* ---------- Vyhledávání boxů ---------- */
  const search = $("#box-search");
  const locItems = $$("#loc-list .loc");
  const pins = $$(".map .pin");
  const locEmpty = $(".loc-empty");
  let typeFilter = "all";

  const normalize = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  function filterLocations() {
    const q = normalize(search.value.trim());
    let visible = 0;
    locItems.forEach((btn) => {
      const matchText = !q || normalize(btn.textContent).includes(q);
      const matchType = typeFilter === "all" || btn.dataset.type === typeFilter;
      const show = matchText && matchType;
      btn.parentElement.hidden = !show;
      const pin = pins.find((p) => p.dataset.pin === btn.dataset.pin);
      if (pin) pin.classList.toggle("is-dim", !show);
      if (show) visible++;
    });
    locEmpty.hidden = visible > 0;
  }
  search.addEventListener("input", filterLocations);
  chipGroup($$(".loc-types .chip"), "type", (type) => { typeFilter = type; filterLocations(); });

  function selectLocation(id, scrollList) {
    locItems.forEach((b) => b.classList.toggle("is-active", b.dataset.pin === id));
    pins.forEach((p) => p.classList.toggle("is-active", p.dataset.pin === id));
    const item = locItems.find((b) => b.dataset.pin === id);
    if (item && scrollList) item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // předvyplň box ve formuláři
    if (item) {
      const name = $("strong", item).textContent;
      const opt = $$("#f-box option").find((o) => o.textContent === name);
      if (opt) $("#f-box").value = opt.value;
    }
  }
  locItems.forEach((b) => b.addEventListener("click", () => selectLocation(b.dataset.pin, false)));
  pins.forEach((p) => p.addEventListener("click", () => selectLocation(p.dataset.pin, true)));

  // "Najít nejbližší" – demo: vybere nejbližší box s volným místem
  const locateBtn = $("#locate-btn");
  locateBtn.addEventListener("click", () => {
    const original = locateBtn.innerHTML;
    locateBtn.disabled = true;
    locateBtn.textContent = "Hledám…";
    const done = () => {
      locateBtn.disabled = false;
      locateBtn.innerHTML = original;
      typeFilter = "all";
      search.value = "";
      $$(".loc-types .chip").forEach((b, i) => { b.classList.toggle("is-active", i === 0); b.setAttribute("aria-pressed", String(i === 0)); });
      filterLocations();
      selectLocation("1", true);
    };
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(done, done, { timeout: 4000 });
    } else {
      setTimeout(done, 600);
    }
  });

  /* ---------- Přepínač ceníku ---------- */
  const amounts = $$(".price-big .amount");
  chipGroup($$(".billing-toggle .toggle-opt"), "billing", (mode) => {
    amounts.forEach((el) => {
      el.classList.add("is-changing");
      setTimeout(() => {
        el.textContent = el.dataset[mode];
        el.classList.remove("is-changing");
      }, 180);
    });
  });

  /* ---------- Výběr programu z karty ---------- */
  $$("[data-program-select]").forEach((btn) => {
    btn.addEventListener("click", () => { $("#f-program").value = btn.dataset.programSelect; });
  });

  /* ---------- FAQ: otevřená vždy jen jedna ---------- */
  const faqItems = $$(".faq details");
  faqItems.forEach((d) => {
    d.addEventListener("toggle", () => {
      if (d.open) faqItems.forEach((o) => { if (o !== d) o.open = false; });
    });
  });

  /* ---------- Objednávkový formulář (demo) ---------- */
  const form = $("#order-form");
  const dateInput = $("#f-date");
  const emailInput = $("#f-email");
  const emailError = $("#email-error");
  const success = $("#form-success");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  dateInput.min = iso(new Date());
  dateInput.value = iso(tomorrow);

  emailInput.addEventListener("input", () => {
    if (emailInput.validity.valid) {
      emailInput.removeAttribute("aria-invalid");
      emailError.hidden = true;
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!emailInput.value || !emailInput.validity.valid) {
      emailInput.setAttribute("aria-invalid", "true");
      emailInput.setAttribute("aria-describedby", "email-error");
      emailError.hidden = false;
      emailInput.focus();
      return;
    }
    const data = new FormData(form);
    const date = new Date(data.get("date") + "T00:00");
    const dateText = isNaN(date) ? "" : date.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" });
    const code = String(Math.floor(1000 + Math.random() * 9000));
    $("#success-text").textContent =
      `BoxTeplo ${data.get("program")} čeká v boxu ${data.get("box")} – ${dateText} v ${data.get("time")}. ` +
      `Tvůj kód: ${code}. Potvrzení jsme poslali na ${data.get("email")}.`;
    success.hidden = false;
  });

  /* ---------- Rok v patičce ---------- */
  $("#year").textContent = new Date().getFullYear();
})();
