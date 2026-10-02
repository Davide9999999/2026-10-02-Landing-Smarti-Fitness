(() => {
  "use strict";

  /* ---------- Configurazione invio form ----------
     endpoint: URL di una Web App Google Apps Script con doPost(e) che legge
               e.parameter.{servizio,nome,cognome,email,messaggio}.
     email:    usata come fallback (mailto) se endpoint è vuoto.
     Se entrambi sono vuoti, la richiesta viene copiata negli appunti
     e si apre la chat Instagram. */
  const CONFIG = {
    endpoint: "",
    email: "",
    instagramDM: "https://ig.me/m/smarti_fitness"
  };

  const $ = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  window.addEventListener("load", () => document.body.classList.add("is-loaded"));
  $("#year").textContent = new Date().getFullYear();

  /* ---------- Nav: stato scroll, hide on scroll down, progress ---------- */
  const nav = $("#nav");
  const progress = $(".progress");
  let lastY = 0;
  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav.classList.toggle("is-scrolled", y > 40);
    if (!nav.classList.contains("is-open")) {
      nav.classList.toggle("is-hidden", y > lastY && y > 400);
    }
    lastY = y;
    ticking = false;
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* ---------- Menu mobile ---------- */
  const toggle = $(".nav__toggle");
  const setMenu = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Chiudi menu" : "Apri menu");
    document.body.style.overflow = open ? "hidden" : "";
  };
  toggle.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));
  $$(".nav__menu a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  /* ---------- Reveal on scroll ---------- */
  const reveals = $$(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("is-in"));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
        el.style.transitionDelay = `${Math.min(siblings.indexOf(el), 4) * 90}ms`;
        el.classList.add("is-in");
        io.unobserve(el);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach((el) => io.observe(el));
  }

  /* ---------- Sticky CTA mobile: visibile dopo l'hero, nascosta sul form ---------- */
  const sticky = $(".sticky-cta");
  const hero = $(".hero");
  const contact = $("#contatti");
  if ("IntersectionObserver" in window) {
    const state = { hero: true, contact: false };
    const update = () => sticky.classList.toggle("is-visible", !state.hero && !state.contact);
    new IntersectionObserver(([e]) => { state.hero = e.isIntersecting; update(); }).observe(hero);
    new IntersectionObserver(([e]) => { state.contact = e.isIntersecting; update(); }, { threshold: 0.1 }).observe(contact);
  }

  /* ---------- Bottoni percorso: preseleziona e porta al form ---------- */
  const form = $("#leadForm");
  $$("[data-plan]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const radio = form.querySelector(`input[name="servizio"][value="${btn.dataset.plan}"]`);
      if (radio) radio.checked = true;
      contact.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      setTimeout(() => $("#nome").focus({ preventScroll: true }), reduceMotion ? 0 : 700);
    });
  });

  /* ---------- Form ---------- */
  const status = $("#formStatus");
  const submitBtn = $("#submitBtn");
  const setStatus = (msg, type) => {
    status.textContent = msg;
    status.className = `form__status${type ? ` is-${type}` : ""}`;
  };

  const validate = () => {
    let ok = true;
    $$(".field", form).forEach((f) => {
      const input = f.querySelector("input");
      if (!input) return;
      const bad = !input.checkValidity();
      f.classList.toggle("is-invalid", bad);
      if (bad) ok = false;
    });
    if (!form.querySelector('input[name="servizio"]:checked')) ok = false;
    if (!form.privacy.checked) ok = false;
    return ok;
  };

  const buildText = (d) =>
    `Ciao Martina! Vorrei informazioni sul percorso ${d.servizio}.\n` +
    `Nome: ${d.nome} ${d.cognome}\nEmail: ${d.email}` +
    (d.messaggio ? `\nNote: ${d.messaggio}` : "");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) {
      setStatus("Compila i campi obbligatori e scegli un percorso.", "err");
      form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake");
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    delete data.privacy;
    submitBtn.disabled = true;
    submitBtn.textContent = "Invio in corso…";
    setStatus("");

    try {
      if (CONFIG.endpoint) {
        // no-cors: Apps Script non espone header CORS; la risposta è opaca.
        await fetch(CONFIG.endpoint, { method: "POST", mode: "no-cors", body: new URLSearchParams(data) });
        setStatus("Richiesta inviata! Ti ricontatto al più presto 💪", "ok");
        form.reset();
      } else if (CONFIG.email) {
        const subject = encodeURIComponent(`Richiesta info percorso ${data.servizio}`);
        window.location.href = `mailto:${CONFIG.email}?subject=${subject}&body=${encodeURIComponent(buildText(data))}`;
        setStatus("Si sta aprendo la tua app di posta per completare l'invio.", "ok");
      } else {
        try { await navigator.clipboard.writeText(buildText(data)); } catch (_) { /* clipboard non disponibile */ }
        window.open(CONFIG.instagramDM, "_blank", "noopener");
        setStatus("Messaggio copiato: incollalo nella chat Instagram che si è appena aperta.", "ok");
      }
    } catch (err) {
      setStatus("Qualcosa è andato storto. Riprova o scrivimi su Instagram.", "err");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Invia richiesta";
    }
  });

  form.addEventListener("input", (e) => {
    const f = e.target.closest(".field");
    if (f && f.classList.contains("is-invalid")) f.classList.toggle("is-invalid", !e.target.checkValidity());
  });
})();
