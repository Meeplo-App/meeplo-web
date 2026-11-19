// The public directory of places (/lugares/, P154): reads one page of places through browse_places_page (Meeplo-iOS
// migration 082) and renders a link to each place's own page, /t/?s=<slug>. Read-only: nothing here writes or needs
// an account.
(function () {
  "use strict";

  var BACKENDS = {
    production: { url: "https://szulqqeyuxjqpynvggvy.supabase.co", key: "sb_publishable_6C523n0LIzhj56sVMvh5NA_y_7yM41w" },
    staging:    { url: "https://osakliycgbzjasdyxsam.supabase.co", key: "sb_publishable_tJmwwVKApf6blc5Rs10JwA_dkgGtYTc" },
    local:      { url: "http://127.0.0.1:54321",                   key: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" },
  };

  var storeRules = window.MeeploStore;
  var rules = window.MeeploPlaces;
  var backend = chooseBackend();
  var state = rules.parseSearch(location.search);
  var $ = function (id) { return document.getElementById(id); };

  // ?env=staging|local switch the backend only on localhost, as on the other pages. With env=local, ?port= picks
  // another local stack's API port (a UI-test lane's, 55321 and up).
  function chooseBackend() {
    var isLocalHost = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    var params = new URLSearchParams(location.search);
    var env = params.get("env");
    if (!isLocalHost || !env || !BACKENDS[env]) return BACKENDS.production;
    var chosen = BACKENDS[env];
    var port = params.get("port");
    if (env === "local" && /^\d{4,5}$/.test(port || "")) chosen = { url: "http://127.0.0.1:" + port, key: chosen.key };
    return chosen;
  }

  // Keeps ?env= and ?port= on the page's own links while testing locally; nothing in production.
  function withTestParams(href) {
    var params = new URLSearchParams(location.search);
    if (backend === BACKENDS.production && !params.get("port")) return href;
    var extra = new URLSearchParams();
    ["env", "port"].forEach(function (name) { if (params.get(name)) extra.set(name, params.get(name)); });
    var text = extra.toString();
    if (!text) return href;
    return href + (href.indexOf("?") === -1 ? "?" : "&") + text;
  }

  // ---- Data --------------------------------------------------------------------------------------

  function fetchPage() {
    return fetch(backend.url + "/rest/v1/rpc/browse_places_page", {
      method: "POST",
      headers: { apikey: backend.key, Authorization: "Bearer " + backend.key, "Content-Type": "application/json" },
      body: JSON.stringify(rules.rpcArguments(state)),
    }).then(function (response) {
      if (!response.ok) throw new Error("browse_places_page answered " + response.status);
      return response.json();
    });
  }

  // ---- Head: what search engines read ------------------------------------------------------------

  function setHead(items) {
    document.title = rules.documentTitle(state);
    setLink("canonical", rules.canonicalURL(state));
    setMeta("property", "og:url", rules.canonicalURL(state));
    var robots = rules.robotsContent(state);
    if (robots) setMeta("name", "robots", robots);
    var script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(rules.structuredData(state, items));
    document.head.appendChild(script);
  }

  function setLink(rel, href) {
    var link = document.querySelector('link[rel="' + rel + '"]');
    if (!link) { link = document.createElement("link"); link.rel = rel; document.head.appendChild(link); }
    link.href = href;
  }

  function setMeta(attribute, name, content) {
    var meta = document.querySelector("meta[" + attribute + '="' + name + '"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute(attribute, name); document.head.appendChild(meta); }
    meta.content = content;
  }

  // ---- Rendering ---------------------------------------------------------------------------------

  function card(item) {
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.className = "card place";
    a.href = withTestParams(rules.placeURL(item).replace("https://meeplo.com.mx", ""));

    var figure = document.createElement("div");
    figure.className = "cover";
    figure.style.setProperty("--brand", storeRules.brandColor({ is_pro: !!item.brand_color, brand_color: item.brand_color }));
    var path = rules.imagePath(item);
    var drawInitial = function () {
      figure.classList.add("initial");
      figure.textContent = rules.initial(item);
    };
    if (path) {
      var img = document.createElement("img");
      img.src = storeRules.storePhotoURL(backend.url, path);
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.width = 400;
      img.height = 300;
      if (!item.photo_path) figure.classList.add("logo-only");
      img.addEventListener("error", function () { img.remove(); drawInitial(); });
      figure.appendChild(img);
    } else {
      drawInitial();
    }
    a.appendChild(figure);

    var body = document.createElement("div");
    body.className = "card-body";
    var title = document.createElement("h2");
    title.textContent = item.name;
    var line = document.createElement("p");
    line.className = "details";
    line.textContent = rules.cardLine(item);
    body.appendChild(title);
    body.appendChild(line);
    var facts = rules.cardFacts(item);
    if (facts.length) {
      var list = document.createElement("ul");
      list.className = "place-facts";
      facts.forEach(function (fact) {
        var chip = document.createElement("li");
        chip.textContent = fact;
        list.appendChild(chip);
      });
      body.appendChild(list);
    }
    a.appendChild(body);

    li.appendChild(a);
    return li;
  }

  function fillChips() {
    var nav = $("kinds");
    nav.textContent = "";
    rules.chips(state).forEach(function (chip) {
      var a = document.createElement("a");
      a.href = withTestParams(chip.href);
      a.textContent = chip.label;
      if (chip.current) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    });
  }

  function render(data) {
    var items = (data && data.places) || [];
    var total = (data && data.total) || 0;
    setHead(items);

    $("summary").textContent = rules.summaryText(state, total);
    var results = $("results");
    results.textContent = "";
    items.forEach(function (item) { results.appendChild(card(item)); });

    if (!items.length) {
      $("summary").textContent = state.query ? "0 lugares para «" + state.query + "»" : "Todavía no hay lugares aquí.";
      $("empty").hidden = false;
      if (!state.query) $("empty-title").textContent = "Todavía no hay lugares aquí.";
    }

    var pages = rules.pageCount(total);
    var previous = $("previous");
    var next = $("next");
    previous.hidden = state.page <= 1;
    next.hidden = state.page >= pages;
    previous.href = withTestParams(rules.pageHref(state.query, state.tipo, state.page - 1));
    next.href = withTestParams(rules.pageHref(state.query, state.tipo, state.page + 1));
    $("pager").hidden = previous.hidden && next.hidden;
  }

  function fail() {
    $("summary").textContent = "";
    $("failed").hidden = false;
    $("retry").href = location.href;
    setMeta("name", "robots", "noindex");
  }

  function start() {
    $("places-title").textContent = rules.heading(state);
    fillChips();
    var input = $("q");
    input.value = state.query;
    // The form submits ?q=…; keep the kind and the local test parameters on it.
    var params = new URLSearchParams(location.search);
    var keep = function (name, value) {
      var hidden = document.createElement("input");
      hidden.type = "hidden"; hidden.name = name; hidden.value = value;
      input.form.appendChild(hidden);
    };
    if (state.tipo) keep("tipo", state.tipo);
    ["env", "port"].forEach(function (name) {
      if (backend !== BACKENDS.production && params.get(name)) keep(name, params.get(name));
    });
    fetchPage().then(render, fail);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
