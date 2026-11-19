// The public store page: reads one store through browse_store_page and renders it read-only. Every account
// action opens the download sheet; nothing here writes or navigates inside Meeplo. The store's own website,
// Instagram, menu, its map page (or a maps search for its address) are the only links out. Since the legal texts
// 1.4 (P154) the page is indexable: it sets its title, description, canonical address and structured data once
// the store loads, and noindex when there is no store to show.
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
    library: "Para ver todos sus juegos de la casa necesitas la app.",
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

  // ?env=staging|local switch the backend only on localhost. With env=local, ?port= picks another local stack's API
  // port (a UI-test lane's, 55321 and up), as on /buscar/ and /lugares/.
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

  // ---- Data --------------------------------------------------------------------------------------

  // Asks for places to play: without p_with_play_places the server never answers with a game space, nor says
  // what playing at a shop is like. A backend before migration 074 has no such parameter (PostgREST answers
  // PGRST202, no function with those arguments), so the page asks again as before and shows a plain store.
  function fetchStore(value) {
    return callStorePage({ p_slug: value, p_with_play_places: true }).then(function (result) {
      return result.kind === "missing-function" ? callStorePage({ p_slug: value }) : result;
    }).then(function (result) {
      return result.kind === "missing-function" ? { kind: "generic" } : result;
    }).catch(function () { return { kind: "generic" }; });
  }

  function callStorePage(args) {
    return fetch(backend.url + "/rest/v1/rpc/browse_store_page", {
      method: "POST",
      headers: { apikey: backend.key, Authorization: "Bearer " + backend.key, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    }).then(function (response) {
      return response.text().then(function (text) {
        if (response.ok) return { kind: "store", data: JSON.parse(text) };
        if (text.indexOf("STORE_NOT_AVAILABLE") !== -1) return { kind: "unavailable" };
        if (text.indexOf("PGRST202") !== -1) return { kind: "missing-function" };
        return { kind: "generic" };
      });
    });
  }

  // ---- Rendering ---------------------------------------------------------------------------------

  function render(state) {
    $("store").hidden = state.kind !== "store";
    $("unavailable").hidden = state.kind !== "unavailable";
    $("generic").hidden = state.kind !== "generic";
    if (state.kind === "store") fillStore(state.data);
    else setMeta("name", "robots", "noindex");
    showBanner();
  }

  function fillStore(page) {
    var store = page.store;
    fillSearchTags(page);
    fillCover(store);
    fillVisit(store, page.play);
    fillFacts(rules.placeFacts(store, page.play));
    fillPhotos(store);
    fillGallery(rules.galleryPhotos(page.play), store);
    fillPlay(rules.playFacts(page.play));
    fillEvents(page.events || [], page.event_count || 0, store);
    // A place that does not sell has nothing «En venta» (the server sends no listings): no section, as the apps
    // show no tab.
    $("games-block").hidden = !rules.sellsGames(store);
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
    $("verified-label").textContent = rules.verifiedLabel(store);
    var kind = rules.venueKindLabel(store);
    $("kind").textContent = kind || "";
    $("kind").hidden = !kind;
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

  // ---- Search engines ----------------------------------------------------------------------------
  // Google renders the page, so what is set here is what it indexes. The static HTML has no robots tag; a page
  // with no store to show (unavailable, generic) gets noindex instead (render).

  function fillSearchTags(page) {
    var store = page.store;
    document.title = rules.searchTitle(store);
    var description = rules.searchDescription(store, page.play);
    setMeta("name", "description", description);
    setMeta("property", "og:title", store.name + " · Meeplo");
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", rules.canonicalURL(slug));
    var link = document.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    link.href = rules.canonicalURL(slug);
    var photos = [store.cover_photo_path].concat(store.photos || [])
      .concat(rules.galleryPhotos(page.play).map(function (photo) { return photo.path; }))
      .filter(Boolean)
      .map(function (path) { return rules.storePhotoURL(backend.url, path); });
    var logo = store.logo_path ? rules.storePhotoURL(backend.url, store.logo_path) : null;
    var script = document.getElementById("structured-data");
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = "structured-data";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(rules.structuredData(store, page.play, slug, photos, logo));
  }

  function setMeta(attribute, name, content) {
    var meta = document.querySelector("meta[" + attribute + '="' + name + '"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute(attribute, name); document.head.appendChild(meta); }
    meta.content = content;
  }

  function fillVisit(store, play) {
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
    var reviews = rules.reviewsURL(platform, store);
    if (reviews) links.appendChild(link("Ver reseñas en mapas", reviews));
    var menu = rules.menuURL(play);
    if (menu) links.appendChild(link("Ver menú", menu));
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

  // «Se juega aquí», «Vende juegos», «Comida y bebida»: what the place offers, as the apps' chips. None for a
  // shop where nobody plays.
  function fillFacts(facts) {
    var list = $("place-facts");
    list.textContent = "";
    facts.forEach(function (fact) { list.appendChild(text("li", "", fact)); });
    list.hidden = !facts.length;
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

  // The gallery of a place where people play: its photos, newest first, each with its label, and chips that
  // narrow them to one label, as on the apps' page. Nothing for a place without one.
  function fillGallery(photos, store) {
    var block = $("gallery-block");
    block.hidden = !photos.length;
    if (!photos.length) return;
    var list = $("gallery");
    list.textContent = "";
    photos.forEach(function (photo, index) {
      var li = document.createElement("li");
      li.setAttribute("data-kind", photo.kind);
      var img = document.createElement("img");
      img.src = rules.storePhotoURL(backend.url, photo.path);
      img.alt = rules.galleryLabel(photo.kind) + ": foto " + (index + 1) + " de " + store.name;
      img.loading = "lazy";
      li.appendChild(img);
      li.appendChild(text("span", "label", rules.galleryLabel(photo.kind)));
      list.appendChild(li);
    });
    var chips = $("gallery-chips");
    chips.textContent = "";
    rules.galleryChips(photos).forEach(function (chip, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = chip.label;
      button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
      button.addEventListener("click", function () {
        chips.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b === button ? "true" : "false"); });
        list.querySelectorAll("li").forEach(function (li) {
          li.hidden = chip.kind !== null && li.getAttribute("data-kind") !== chip.kind;
        });
      });
      chips.appendChild(button);
    });
    chips.hidden = !chips.children.length;
  }

  // «Para jugar aquí»: what playing costs, the house rules and the first of its «Juegos de la casa». Nothing for
  // a place where nobody plays.
  function fillPlay(play) {
    $("play-block").hidden = !play;
    if (!play) return;
    $("play-fee").textContent = play.fee || "";
    $("play-fee").hidden = $("play-fee-label").hidden = !play.fee;
    $("play-rules").textContent = play.rules || "";
    $("play-rules").hidden = $("play-rules-label").hidden = !play.rules;
    $("play-facts").hidden = !play.fee && !play.rules;
    var list = $("library");
    list.textContent = "";
    play.games.forEach(function (game) {
      var li = document.createElement("li");
      li.appendChild(text("span", "title", game.name));
      if (game.note) li.appendChild(text("span", "note", game.note));
      list.appendChild(li);
    });
    $("library-block").hidden = !play.games.length;
    var more = $("library-more");
    more.hidden = play.count <= play.games.length;
    more.textContent = rules.countLabel(play.count, "el juego", "juegos");
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
      li.appendChild(text("p", "organiser", rules.organiserLine(store.name)));
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
