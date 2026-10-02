/* ==========================================================
   Dott. Nicolò Gamberini — script condiviso
   Le pagine sono già generate dal build (scripts/build.mjs):
   qui solo interazioni (menu, filtri blog, indice articolo, form).
   ========================================================== */
(function () {
  "use strict";

  var WA_NUMBER = "393715912105";
  var page = document.body.getAttribute("data-page");

  /* ---------- Utility ---------- */
  function $(s, ctx) { return (ctx || document).querySelector(s); }
  function $$(s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDate(iso) {
    return new Date(iso + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  }
  function norm(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

  /* ---------- Nav ---------- */
  var nav = $(".nav");
  if (nav) {
    var toggle = $(".nav__toggle", nav);
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open);
      toggle.setAttribute("aria-label", open ? "Chiudi menu" : "Apri menu");
    });
    $$(".nav__menu a", nav).forEach(function (a) {
      a.addEventListener("click", function () { nav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); });
    });
    var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Reveal on scroll ---------- */
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px" }) : null;
  function observe(ctx) {
    $$(".reveal:not(.is-in)", ctx).forEach(function (el) { io ? io.observe(el) : el.classList.add("is-in"); });
  }

  /* ==========================================================
     HOME
     ========================================================== */
  if (page === "home") {
    // Recensioni lunghe: "Leggi tutto"
    $$(".review p").forEach(function (p) {
      if (p.textContent.length < 260) return;
      p.classList.add("is-clamped");
      var b = document.createElement("button");
      b.className = "review__more"; b.type = "button"; b.textContent = "Leggi tutto";
      b.addEventListener("click", function () {
        var c = p.classList.toggle("is-clamped");
        b.textContent = c ? "Leggi tutto" : "Mostra meno";
      });
      p.insertAdjacentElement("afterend", b);
    });

    // Form → messaggio WhatsApp precompilato (nessun backend necessario)
    var form = $("#contact-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!form.reportValidity()) return;
        var f = form.elements;
        var msg = "Ciao Dott. Gamberini, sono " + f.nome.value.trim() + ".\n" +
          "Mi interessa: " + f.obiettivo.value + ".\n" +
          (f.messaggio.value.trim() ? f.messaggio.value.trim() + "\n" : "") +
          (f.telefono.value.trim() ? "Il mio numero: " + f.telefono.value.trim() : "");
        window.open("https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
      });
    }
  }

  /* ==========================================================
     BLOG — filtri e ricerca sui dati incorporati dal build
     ========================================================== */
  if (page === "blog" && window.ARTICOLI) {
    var CATS = window.CATS, POSTS = window.ARTICOLI;
    var grid = $("#posts"), info = $("#results-info"), more = $("#load-more"), q = $("#q"), filters = $("#filters");
    var params = new URLSearchParams(location.search);
    var state = { cat: CATS[params.get("cat")] ? params.get("cat") : "all", q: params.get("q") || "", shown: 9 };
    q.value = state.q;

    var card = function (p, featured) {
      var cat = p.cats[0];
      return '<a class="post' + (featured ? " post--featured" : "") + ' reveal" href="' + p.url + '">' +
        '<div class="post__img"><img src="' + esc(p.img) + '" alt="" loading="lazy"></div>' +
        '<div class="post__body"><div class="post__meta"><span class="chip" data-cat="' + cat + '">' + esc(CATS[cat]) + "</span>" +
        "<span>" + fmtDate(p.date) + '</span><span aria-hidden="true">·</span><span>' + p.min + " min</span></div>" +
        "<h3>" + esc(p.title) + "</h3><p>" + esc(p.excerpt) + '</p><span class="post__more">Leggi l\'articolo →</span></div></a>';
    };
    var filtered = function () {
      var t = norm(state.q.trim());
      return POSTS.filter(function (p) {
        if (state.cat !== "all" && p.cats.indexOf(state.cat) === -1) return false;
        return !t || norm(p.title + " " + p.excerpt + " " + p.tags.join(" ")).indexOf(t) > -1;
      });
    };
    var render = function () {
      var list = filtered();
      var isDefault = state.cat === "all" && !state.q.trim();
      $$(".filter", filters).forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-cat") === state.cat); });
      grid.innerHTML = list.length
        ? list.slice(0, state.shown).map(function (p, i) { return card(p, isDefault && i === 0); }).join("")
        : '<div class="empty"><h3>Nessun articolo trovato</h3><p>Prova con un altro termine o scegli “Tutti”.</p></div>';
      info.textContent = list.length + (list.length === 1 ? " articolo" : " articoli") +
        (state.cat !== "all" ? " in “" + CATS[state.cat] + "”" : "") +
        (state.q.trim() ? " per “" + state.q.trim() + "”" : "");
      more.hidden = list.length <= state.shown;
      observe(grid);
      var u = new URLSearchParams();
      if (state.cat !== "all") u.set("cat", state.cat);
      if (state.q.trim()) u.set("q", state.q.trim());
      history.replaceState(null, "", location.pathname + (u.toString() ? "?" + u : ""));
    };

    filters.addEventListener("click", function (e) {
      var b = e.target.closest(".filter"); if (!b) return;
      state.cat = b.getAttribute("data-cat"); state.shown = 9; render();
    });
    var t;
    q.addEventListener("input", function () {
      clearTimeout(t); t = setTimeout(function () { state.q = q.value; state.shown = 9; render(); }, 160);
    });
    $("button", more).addEventListener("click", function () { state.shown += 9; render(); });
    // Le prime 9 card sono già nell'HTML: si ri-renderizza solo se servono filtri o "carica altri"
    if (state.cat !== "all" || state.q) render(); else more.hidden = POSTS.length <= state.shown;
  }

  /* ==========================================================
     ARTICOLO
     ========================================================== */
  if (page === "article") {
    var body = $("#a-body");

    // Bibliografia: titolo e contenuti successivi in un box compatto
    $$("h2, h3", body).forEach(function (h) {
      if (!/^\s*bibliografia\s*$/i.test(h.textContent)) return;
      var box = document.createElement("section");
      box.className = "biblio";
      h.parentNode.insertBefore(box, h);
      while (box.nextSibling) box.appendChild(box.nextSibling);
    });

    // Indice dei contenuti dagli H2
    var heads = $$("h2", body), toc = $("#toc-list");
    heads.forEach(function (h, i) {
      h.id = "sez-" + (i + 1);
      var li = document.createElement("li");
      li.innerHTML = '<a href="#' + h.id + '">' + esc(h.textContent) + "</a>";
      toc.appendChild(li);
    });
    if (heads.length < 2) $(".toc").style.visibility = "hidden";
    if ("IntersectionObserver" in window && heads.length) {
      var links = $$("a", toc);
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (l) { l.classList.toggle("is-active", l.getAttribute("href") === "#" + e.target.id); });
        });
      }, { rootMargin: "-20% 0px -70% 0px" });
      heads.forEach(function (h) { spy.observe(h); });
    }

    // Copia link
    var copy = $("#share-copy");
    if (copy) copy.addEventListener("click", function () {
      var url = location.href.split("#")[0];
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () {
        copy.setAttribute("title", "Link copiato!"); copy.style.borderColor = "var(--brand)";
      }).catch(function () { prompt("Copia il link:", url); });
    });

    // Barra di avanzamento lettura
    var bar = $(".progress");
    if (bar) {
      var onRead = function () {
        var r = body.getBoundingClientRect();
        var pct = Math.min(1, Math.max(0, -r.top / (r.height - window.innerHeight * 0.6)));
        bar.style.width = (pct * 100) + "%";
      };
      window.addEventListener("scroll", onRead, { passive: true });
      onRead();
    }
  }

  observe(document);
})();
