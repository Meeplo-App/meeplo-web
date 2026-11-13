// The public store page: reads one store through browse_store_page and renders it read-only. Every account
// action opens the download sheet; nothing here writes or navigates inside Meeplo. The store's own website,
// Instagram and a maps search for its address are the only links out.
(function () {
  "use strict";

  var BACKENDS = {
    production: { url: "https://szulqqeyuxjqpynvggvy.supabase.co", key: "sb_publishable_6C523n0LIzhj56sVMvh5NA_y_7yM41w" },
    staging:    { url: "https://osakliycgbzjasdyxsam.supabase.co", key: "sb_publishable_tJmwwVKApf6blc5Rs10JwA_dkgGtYTc" },
    local:      { url: "http://127.0.0.1:54321",                   key: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" },
  };
  // Flipped to true once the iOS app registers com.meeplo.meeploapp as a URL scheme (as in listing.js).
  var IOS_SCHEME_REGISTERED = false;
  var APP_STORE_ID = "6824672527";
  var APPLE_STORE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.7c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1.1-2.8-4.1zM14 5.3c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z"/></svg>';
  var PLAY_SVG = '<svg viewBox="0 0 24 26" fill="none" aria-hidden="true"><path d="M3 2 22 13 3 24V2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m3 2 12 16M3 24 15 8" stroke="currentColor" stroke-width="1.3"/></svg>';
  var REASONS = {
    store: "Para ver todo lo de esta tienda y conversar con ella necesitas la app.",
    game: "Para ver este juego y conversar con la tienda necesitas la app.",
    games: "Para ver todos sus juegos necesitas la app.",
    reserve: "Para apartar tu lugar en este evento necesitas la app.",
    events: "Para ver todos sus eventos necesitas la app.",
    default: "Para seguir necesitas la app.",
  };

  var listing = window.MeeploListing;
  var rules = window.MeeploStore;
  var backend = chooseBackend();
  var platform = listing.detectPlatform({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    uaPlatform: navigator.userAgentData && navigator.userAgentData.platform,
  });
  var slug = rules.parseSlug(location.search);
  var $ = function (id) { return document.getElementById(id); };

  function chooseBackend() {
    var isLocalHost = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    var env = new URLSearchParams(location.search).get("env");
    if (isLocalHost && env && BACKENDS[env]) return BACKENDS[env];
    return BACKENDS.production;
  }

  // ---- Data --------------------------------------------------------------------------------------

  function fetchStore(value) {
    return fetch(backend.url + "/rest/v1/rpc/browse_store_page", {
      method: "POST",
      headers: { apikey: backend.key, Authorization: "Bearer " + backend.key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: value }),
    }).then(function (response) {
      return response.text().then(function (text) {
        if (response.ok) return { kind: "store", data: JSON.parse(text) };
        if (text.indexOf("STORE_NOT_AVAILABLE") !== -1) return { kind: "unavailable" };
        return { kind: "generic" };
      });
    }).catch(function () { return { kind: "generic" }; });
  }

  // ---- Rendering ---------------------------------------------------------------------------------

  function render(state) {
    $("store").hidden = state.kind !== "store";
    $("unavailable").hidden = state.kind !== "unavailable";
    $("generic").hidden = state.kind !== "generic";
    if (state.kind === "store") fillStore(state.data);
    showBanner();
  }

  function fillStore(page) {
    var store = page.store;
    document.title = store.name + " · Meeplo";
    fillCover(store);
    fillVisit(store);
    fillPhotos(store);
    fillEvents(page.events || [], page.event_count || 0, store);
    fillGames(page.listings || [], page.listing_count || 0);
  }

  function fillCover(store) {
    var cover = $("cover");
    cover.style.setProperty("--brand", rules.brandColor(store));
    if (store.cover_photo_path) {
      cover.classList.add("with-photo");
      cover.style.setProperty("--cover-photo", 'url("' + rules.storePhotoURL(backend.url, store.cover_photo_path) + '")');
      cover.style.setProperty("--cover-focus", Math.round((store.cover_photo_focus == null ? 0.5 : store.cover_photo_focus) * 100) + "%");
    }
    cover.classList.add("style-" + (store.cover_style || "aurora"));
    $("pro-seal").hidden = !store.is_pro;
    $("verified").hidden = !!store.is_pro;
    $("name").textContent = store.name;
    $("description").textContent = store.description || "";
    $("description").hidden = !store.description;
    var box = $("logo-box");
    box.classList.toggle("dark", store.logo_background === "dark");
    if (store.logo_path) {
      var logo = $("logo");
      logo.src = rules.storePhotoURL(backend.url, store.logo_path);
      logo.alt = "Logo de " + store.name;
      logo.hidden = false;
      $("logo-fallback").hidden = true;
    } else {
      $("logo-fallback").textContent = store.name.trim().charAt(0).toUpperCase();
    }
  }

  function fillVisit(store) {
    var status = $("status");
    if (store.is_online) {
      status.textContent = "Tienda en línea";
      status.className = "status";
    } else {
      var open = rules.openStatus(store.hours, store.time_zone, new Date());
      status.textContent = rules.openStatusText(open);
      status.className = "status" + (open.kind === "open" ? " open" : "");
    }
    $("city").textContent = store.city;
    $("address").textContent = store.address || "";
    $("address").hidden = $("address-label").hidden = !store.address;

    var links = $("links");
    links.textContent = "";
    if (store.address) {
      links.appendChild(link("Cómo llegar", rules.mapsURL(platform, store.name, store.address)));
    }
    if (store.website) links.appendChild(link("Sitio web", store.website));
    if (store.instagram) links.appendChild(link("Instagram @" + store.instagram, rules.instagramURL(store.instagram)));
    links.hidden = !links.children.length;

    var rows = $("hours");
    rows.textContent = "";
    rules.weekRows(store.hours).forEach(function (row) {
      var dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = row.name; dd.textContent = row.text;
      rows.appendChild(dt); rows.appendChild(dd);
    });
    $("hours-block").hidden = store.is_online;
  }

  // A link out of Meeplo to the store's own places on the web, in a new tab.
  function link(label, href) {
    var a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener nofollow";
    a.textContent = label;
    var arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = " ↗";
    a.appendChild(arrow);
    return a;
  }

  function fillPhotos(store) {
    var list = $("photos");
    list.textContent = "";
    (store.photos || []).forEach(function (path, index) {
      var li = document.createElement("li");
      var img = document.createElement("img");
      img.src = rules.storePhotoURL(backend.url, path);
      img.alt = "Foto " + (index + 1) + " de " + store.name;
      img.loading = "lazy";
      li.appendChild(img); list.appendChild(li);
    });
    list.hidden = !list.children.length;
  }

  function fillEvents(events, count, store) {
    var list = $("events");
    list.textContent = "";
    $("events-block").hidden = !events.length;
    events.forEach(function (event) {
      var li = document.createElement("li");
      li.className = "event";
      li.appendChild(text("p", "when", rules.eventDate(event.starts_at, store.time_zone)));
      li.appendChild(text("h3", "", event.title));
      if (event.description) li.appendChild(text("p", "what", event.description));
      var where = event.place_name ? event.place_name + " · " + event.place_address
                                   : store.is_online ? null : "En la tienda";
      var details = [where, event.price_note, rules.placesLeftText(event.places_left)].filter(Boolean);
      li.appendChild(text("p", "details", details.join(" · ")));
      var full = event.places_left === 0;
      var button = document.createElement("button");
      button.type = "button";
      button.className = "reserve";
      button.textContent = full ? "Lleno" : "Apartar";
      button.disabled = full;
      button.setAttribute("data-needs-app", "reserve");
      li.appendChild(button);
      list.appendChild(li);
    });
    var more = $("events-more");
    more.hidden = count <= events.length;
    more.textContent = rules.countLabel(count, "el evento", "eventos");
  }

  function fillGames(games, count) {
    var list = $("games");
    list.textContent = "";
    $("games-empty").hidden = games.length > 0;
    games.forEach(function (game) {
      var li = document.createElement("li");
      var button = document.createElement("button");
      button.type = "button";
      button.className = "game";
      button.setAttribute("data-needs-app", "game");
      var img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      if (game.photo_path) img.src = listing.photoURL(backend.url, game.photo_path);
      else { img.src = "/assets/meeplo.png"; img.className = "placeholder"; }
      button.appendChild(img);
      button.appendChild(text("span", "title", game.title));
      button.appendChild(text("span", "price", listing.formatPrice(game.price_amount, game.price_currency)));
      var condition = listing.labels.condition[game.condition] || game.condition;
      button.appendChild(text("span", "condition", game.is_expansion ? condition + " · Expansión" : condition));
      li.appendChild(button);
      list.appendChild(li);
    });
    var more = $("games-more");
    more.hidden = count <= games.length;
    more.textContent = rules.countLabel(count, "el juego", "juegos");
  }

  function text(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    return node;
  }

  // ---- Stores, banner and sheet ------------------------------------------------------------------

  function storeButton(which, compact) {
    var a = document.createElement("a");
    a.className = "store";
    a.href = listing.storeURLs[which];
    a.rel = "noopener";
    a.innerHTML = (which === "ios" ? APPLE_STORE_SVG : PLAY_SVG) +
      (compact ? (which === "ios" ? "App Store" : "Google Play")
               : (which === "ios" ? "Descargar en el App Store" : "Descargar en Google Play"));
    return a;
  }

  function fillStores() {
    var which = platform === "other" ? ["ios", "android"] : [platform];
    document.querySelectorAll("[data-stores]").forEach(function (box) {
      box.textContent = "";
      var compact = box.hasAttribute("data-compact");
      (compact && which.length > 1 ? ["ios"] : which).forEach(function (w) { box.appendChild(storeButton(w, compact)); });
    });
  }

  function showBanner() {
    var dismissed = false;
    try { dismissed = sessionStorage.getItem("banner.dismissed") === "1"; } catch (e) { /* private mode */ }
    $("banner").hidden = dismissed;
  }

  function openSheet(reason) {
    var sheet = $("sheet");
    $("sheet-reason").textContent = REASONS[reason] || REASONS.default;
    $("open-app").hidden = !slug || !(platform === "android" || (platform === "ios" && IOS_SCHEME_REGISTERED));
    if (typeof sheet.showModal === "function") { if (!sheet.open) sheet.showModal(); }
    else sheet.setAttribute("open", "");
  }

  function closeSheet() {
    var sheet = $("sheet");
    if (typeof sheet.close === "function") sheet.close(); else sheet.removeAttribute("open");
  }

  function openInApp() {
    if (!slug) return;
    if (platform === "android") location.href = rules.androidIntentURL(slug, location.href);
    else if (platform === "ios") location.href = rules.appSchemeURL(slug);
  }

  // ---- Wiring ------------------------------------------------------------------------------------

  document.addEventListener("click", function (event) {
    var target = event.target.closest("[data-needs-app]");
    if (target && !target.disabled) { event.preventDefault(); openSheet(target.getAttribute("data-needs-app")); }
  });
  $("sheet").querySelector(".later").addEventListener("click", closeSheet);
  $("open-app").addEventListener("click", openInApp);
  $("banner").querySelector(".close").addEventListener("click", function () {
    try { sessionStorage.setItem("banner.dismissed", "1"); } catch (e) { /* private mode */ }
    $("banner").hidden = true;
  });

  fillStores();
  if (!slug) {
    render({ kind: "generic" });
  } else {
    var meta = document.querySelector('meta[name="apple-itunes-app"]');
    if (meta) meta.content = "app-id=" + APP_STORE_ID + ", app-argument=" + rules.shareURL(slug);
    fetchStore(slug).then(render);
  }

  window.MeeploPage = { render: render, fetchStore: fetchStore, platform: platform, backend: backend.url };
})();
