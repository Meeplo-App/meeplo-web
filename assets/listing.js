// The public listing page: reads one listing through browse_listing_page and renders it read-only.
// Every account action opens the download sheet; nothing here writes or navigates inside Meeplo.
(function () {
  "use strict";

  var BACKENDS = {
    production: { url: "https://szulqqeyuxjqpynvggvy.supabase.co", key: "sb_publishable_6C523n0LIzhj56sVMvh5NA_y_7yM41w" },
    staging:    { url: "https://osakliycgbzjasdyxsam.supabase.co", key: "sb_publishable_tJmwwVKApf6blc5Rs10JwA_dkgGtYTc" },
    local:      { url: "http://127.0.0.1:54321",                   key: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" },
  };
  // Flipped to true once the iOS app registers com.meeplo.meeploapp as a URL scheme.
  var IOS_SCHEME_REGISTERED = false;
  var APP_STORE_ID = "6824672527";
  var APPLE_STORE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.7c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1.1-2.8-4.1zM14 5.3c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z"/></svg>';
  var PLAY_SVG = '<svg viewBox="0 0 24 26" fill="none" aria-hidden="true"><path d="M3 2 22 13 3 24V2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m3 2 12 16M3 24 15 8" stroke="currentColor" stroke-width="1.3"/></svg>';
  var SEAL_SVG = '<svg class="seal" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.6l2.3 2 3-.4 1 2.9 2.7 1.4-.6 3 1.9 2.4-1.9 2.4.6 3-2.7 1.4-1 2.9-3-.4-2.3 2-2.3-2-3 .4-1-2.9-2.7-1.4.6-3L1.7 12l1.9-2.4-.6-3 2.7-1.4 1-2.9 3 .4z"/><path d="M8 12.3l2.6 2.6L16.3 9" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var REASONS = {
    message: "Para conversar con quien vende necesitas la app.",
    save: "Para guardar este anuncio necesitas la app.",
    seller: "Para ver perfiles necesitas la app.",
    default: "Para seguir necesitas la app.",
  };

  var rules = window.MeeploListing;
  var backend = chooseBackend();
  var platform = rules.detectPlatform({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    uaPlatform: navigator.userAgentData && navigator.userAgentData.platform,
  });
  var $ = function (id) { return document.getElementById(id); };

  function chooseBackend() {
    var isLocalHost = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    var env = new URLSearchParams(location.search).get("env");
    if (isLocalHost && env && BACKENDS[env]) return BACKENDS[env];
    return BACKENDS.production;
  }

  // ---- Data --------------------------------------------------------------------------------------

  function fetchListing(id) {
    return fetch(backend.url + "/rest/v1/rpc/browse_listing_page", {
      method: "POST",
      headers: { apikey: backend.key, Authorization: "Bearer " + backend.key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_listing_id: id }),
    }).then(function (response) {
      return response.text().then(function (text) {
        if (response.ok) return { kind: "listing", data: JSON.parse(text) };
        if (text.indexOf("LISTING_NOT_AVAILABLE") !== -1) return { kind: "unavailable" };
        return { kind: "generic" };
      });
    }).catch(function () { return { kind: "generic" }; });
  }

  // ---- Rendering ---------------------------------------------------------------------------------

  function render(state) {
    $("listing").hidden = state.kind !== "listing";
    $("unavailable").hidden = state.kind !== "unavailable";
    $("generic").hidden = state.kind !== "generic";
    if (state.kind === "listing") fillListing(state.data);
    showBanner();
  }

  function fillListing(bundle) {
    var listing = bundle.listing, seller = bundle.seller;
    document.title = listing.title + " · Meeplo";
    $("title").textContent = listing.title;
    $("price").textContent = rules.formatPrice(listing.price_amount, listing.price_currency);
    fillPhotos(bundle.photos, listing.title);
    fillFacts(listing);
    $("description").textContent = listing.description || "";
    $("description").hidden = !listing.description;
    fillSeller(seller);
    fillPlaces(bundle.places);
  }

  function fillPhotos(photos, title) {
    var list = $("photos");
    list.textContent = "";
    if (!photos.length) {
      var li = document.createElement("li");
      var box = document.createElement("div");
      box.className = "placeholder";
      var img = document.createElement("img");
      img.src = "/assets/meeplo.png"; img.alt = "";
      box.appendChild(img); li.appendChild(box); list.appendChild(li);
      return;
    }
    photos.forEach(function (photo, index) {
      var li = document.createElement("li");
      var img = document.createElement("img");
      img.src = rules.photoURL(backend.url, photo.card_path || photo.storage_path);
      img.alt = index === 0 ? "Foto de " + title : "Foto " + (index + 1) + " de " + title;
      img.loading = index === 0 ? "eager" : "lazy";
      li.appendChild(img); list.appendChild(li);
    });
  }

  function fillFacts(listing) {
    var facts = [];
    facts.push(["Estado", rules.labels.condition[listing.condition] || listing.condition]);
    if (listing.completeness) facts.push(["Completo", listing.completeness]);
    facts.push(["Categoría", rules.labels.category[listing.category] || listing.category]);
    var languages = (listing.languages || []).map(function (l) { return rules.labels.language[l] || l; });
    if (languages.length) facts.push(["Idioma", languages.join(", ")]);
    if (listing.is_expansion) facts.push(["Tipo", "Expansión"]);
    if (listing.extras) facts.push(["Extras", listing.extras]);
    facts.push(["Publicado", rules.relativeDays(listing.created_at)]);
    if (listing.confirmed_at) facts.push(["Confirmado", rules.relativeDays(listing.confirmed_at)]);
    var dl = $("facts");
    dl.textContent = "";
    facts.forEach(function (pair) {
      var dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = pair[0]; dd.textContent = pair[1];
      dl.appendChild(dt); dl.appendChild(dd);
    });
  }

  function fillSeller(seller) {
    var name = $("seller-name");
    name.textContent = seller.username;
    (seller.badges || []).forEach(function (badge) {
      var span = document.createElement("span");
      span.innerHTML = SEAL_SVG;
      span.title = rules.labels.badge[badge] || badge;
      span.style.color = badge === "meeplo_team" ? "var(--purple)" : badge === "founder_seller" ? "#c98a00" : "#2d8a5a";
      name.appendChild(span.firstChild);
    });
    var rating = $("seller-rating");
    if (seller.rating != null && seller.review_count) {
      rating.textContent = "★ " + Number(seller.rating).toFixed(1) + " · " + seller.review_count +
        (seller.review_count === 1 ? " reseña" : " reseñas");
    } else {
      rating.textContent = "";
    }
    var avatar = $("seller-avatar");
    if (seller.avatar_url) {
      avatar.src = rules.avatarURL(backend.url, seller.avatar_url);
      avatar.hidden = false;
      $("seller-avatar-fallback").hidden = true;
    }
  }

  function fillPlaces(places) {
    var list = $("places");
    list.textContent = "";
    $("places-block").hidden = !places.length;
    places.forEach(function (place) {
      var li = document.createElement("li");
      li.textContent = place.name;
      var kind = rules.labels.placeKind[place.kind];
      if (kind) {
        var span = document.createElement("span");
        span.textContent = " · " + kind;
        li.appendChild(span);
      }
      list.appendChild(li);
    });
  }

  // ---- Stores, banner and sheet ------------------------------------------------------------------

  function storeButton(which, compact) {
    var a = document.createElement("a");
    a.className = "store";
    a.href = rules.storeURLs[which];
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
    var open = $("open-app");
    open.hidden = !(platform === "android" || (platform === "ios" && IOS_SCHEME_REGISTERED));
    if (typeof sheet.showModal === "function") { if (!sheet.open) sheet.showModal(); }
    else sheet.setAttribute("open", "");
  }

  function closeSheet() {
    var sheet = $("sheet");
    if (typeof sheet.close === "function") sheet.close(); else sheet.removeAttribute("open");
  }

  function openInApp() {
    var id = rules.parseListingId(location.search);
    if (platform === "android") location.href = rules.androidIntentURL(location.href);
    else if (platform === "ios" && id) location.href = "com.meeplo.meeploapp://listing/" + id;
  }

  // ---- Wiring ------------------------------------------------------------------------------------

  document.addEventListener("click", function (event) {
    var target = event.target.closest("[data-needs-app]");
    if (target) { event.preventDefault(); openSheet(target.getAttribute("data-needs-app")); }
  });
  $("sheet").querySelector(".later").addEventListener("click", closeSheet);
  $("open-app").addEventListener("click", openInApp);
  $("banner").querySelector(".close").addEventListener("click", function () {
    try { sessionStorage.setItem("banner.dismissed", "1"); } catch (e) { /* private mode */ }
    $("banner").hidden = true;
  });

  fillStores();
  var id = rules.parseListingId(location.search);
  if (!id) {
    render({ kind: "generic" });
  } else {
    var meta = document.querySelector('meta[name="apple-itunes-app"]');
    if (meta) meta.content = "app-id=" + APP_STORE_ID + ", app-argument=" + location.href;
    fetchListing(id).then(render);
  }

  window.MeeploPage = { render: render, fetchListing: fetchListing, platform: platform, backend: backend.url };
})();
