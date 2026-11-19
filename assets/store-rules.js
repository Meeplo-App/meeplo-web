// Pure rules for the public store page: no DOM, no network. Loaded by the page as a script (it sets
// window.MeeploStore) and by `node --test tests/` as a CommonJS module. The page also loads listing-rules.js
// for what both pages share (platform, prices, the app's labels, the download links).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MeeploStore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // The database's rule for a slug: lowercase letters, digits and single hyphens, 3 to 40 characters.
  var SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  var PATH = /^\/t\/([^/?#]+)\/?$/;
  var WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  var MEEPLO_PURPLE = "#4a44c6";

  function normalizeSlug(value) {
    if (typeof value !== "string") return null;
    var slug;
    try { slug = decodeURIComponent(value); } catch (e) { return null; }
    slug = slug.trim().toLowerCase();
    return SLUG.test(slug) && slug.length >= 3 && slug.length <= 40 ? slug : null;
  }

  // The `s` query value as a slug, or null when missing or malformed.
  function parseSlug(search) {
    return normalizeSlug(new URLSearchParams(search || "").get("s"));
  }

  // The slug in the link form the apps share, /t/<slug>, which GitHub Pages serves through 404.html; null
  // for any other path.
  function pathSlug(pathname) {
    var match = PATH.exec(pathname || "");
    return match ? normalizeSlug(match[1]) : null;
  }

  // Where 404.html sends a store's link, /t/<slug>: the page's query form, keeping any other parameters
  // (?env=staging on localhost). Null for any other path.
  function pathRedirect(pathname, search) {
    var slug = pathSlug(pathname);
    if (!slug) return null;
    var rest = (search || "").replace(/^\?/, "");
    return "/t/?s=" + slug + (rest ? "&" + rest : "");
  }

  // The link the apps share and print: https://meeplo.com.mx/t/<slug>.
  function shareURL(slug) {
    return "https://meeplo.com.mx/t/" + slug;
  }

  function storePhotoURL(apiURL, path) {
    return apiURL.replace(/\/$/, "") + "/storage/v1/object/public/store-photos/" + path;
  }

  // ---- Opening hours, as the apps read them -------------------------------------------------------

  function minutes(clock) {
    var parts = String(clock).split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function clock(total) {
    var h = Math.floor(total / 60), m = total % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  // The weekday (Monday 1 … Sunday 7) and minute of the day at `now` in `timeZone`.
  function localMoment(now, timeZone) {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(now);
    var get = function (type) { return parts.filter(function (p) { return p.type === type; })[0].value; };
    var weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1;
    return { weekday: weekday, minute: parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10) };
  }

  function dayOf(hours, weekday) {
    return (hours || []).filter(function (d) { return d.day === weekday; })[0] || null;
  }

  // { kind: "open", closes } | { kind: "opensLater", opens } | { kind: "closedNow" } | { kind: "closedToday" }
  function openStatus(hours, timeZone, now) {
    var moment = localMoment(now || new Date(), timeZone || "America/Mexico_City");
    var today = dayOf(hours, moment.weekday);
    if (!today) return { kind: "closedToday" };
    if (moment.minute < minutes(today.opens)) return { kind: "opensLater", opens: clock(minutes(today.opens)) };
    if (moment.minute < minutes(today.closes)) return { kind: "open", closes: clock(minutes(today.closes)) };
    return { kind: "closedNow" };
  }

  // The app's wording: "Abierto ahora · cierra 20:00", "Cerrado · abre 10:00", "Cerrado hoy".
  function openStatusText(status) {
    if (status.kind === "open") return "Abierto ahora · cierra " + status.closes;
    if (status.kind === "opensLater") return "Cerrado · abre " + status.opens;
    return "Cerrado hoy";
  }

  // Seven rows, Monday first: { name: "Lunes", text: "10:00 – 20:00" | "Cerrado" }.
  function weekRows(hours) {
    return WEEKDAYS.map(function (name, index) {
      var day = dayOf(hours, index + 1);
      return {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        text: day ? clock(minutes(day.opens)) + " – " + clock(minutes(day.closes)) : "Cerrado",
      };
    });
  }

  // ---- Events --------------------------------------------------------------------------------------

  // "Sábado 15 de noviembre · 18:00", in the store's time zone.
  function eventDate(iso, timeZone) {
    var date = new Date(iso);
    var zone = timeZone || "America/Mexico_City";
    var day = new Intl.DateTimeFormat("es-MX", { timeZone: zone, weekday: "long", day: "numeric", month: "long" })
      .format(date).replace(",", "");
    var time = new Intl.DateTimeFormat("es-MX", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .format(date);
    return day.charAt(0).toUpperCase() + day.slice(1) + " · " + time;
  }

  // The apps' wording, inside a line of details: "lleno", "queda 1 lugar", "quedan 4 lugares"; null with no
  // limit.
  function placesLeftText(placesLeft) {
    if (placesLeft === null || placesLeft === undefined) return null;
    if (placesLeft <= 0) return "lleno";
    return placesLeft === 1 ? "queda 1 lugar" : "quedan " + placesLeft + " lugares";
  }

  // "Ver los 14 juegos en la app"; "Ver el juego en la app" for one.
  function countLabel(count, one, many) {
    return count === 1 ? "Ver " + one + " en la app" : "Ver los " + count + " " + many + " en la app";
  }

  // ---- Links ---------------------------------------------------------------------------------------

  // A maps search for the store's name and address, never a position: Apple Maps on iPhone and iPad,
  // Google Maps elsewhere.
  function mapsURL(platform, name, address) {
    var query = encodeURIComponent([name, address].filter(Boolean).join(", "));
    return platform === "ios"
      ? "https://maps.apple.com/?q=" + query
      : "https://www.google.com/maps/search/?api=1&query=" + query;
  }

  function instagramURL(handle) {
    return "https://www.instagram.com/" + encodeURIComponent(handle) + "/";
  }

  // Opens the app on Android when Chrome did not verify the App Link; falls back to the page itself.
  function androidIntentURL(slug, pageURL) {
    return "intent://meeplo.com.mx/t/" + slug +
      "#Intent;scheme=https;package=com.meeplo.meeploapp;S.browser_fallback_url=" +
      encodeURIComponent(pageURL) + ";end";
  }

  // The app's own scheme, which both apps read.
  function appSchemeURL(slug) {
    return "com.meeplo.meeploapp://store/" + slug;
  }

  // ---- Colour --------------------------------------------------------------------------------------

  // A Pro store's colour when it is a valid hex colour; Meeplo's purple otherwise.
  function brandColor(store) {
    var color = store && store.is_pro && store.brand_color;
    return /^#[0-9a-fA-F]{6}$/.test(color || "") ? color.toLowerCase() : MEEPLO_PURPLE;
  }

  // ---- Places to play --------------------------------------------------------------------------------

  // The two kinds of place, as the apps say them (the owner's decision of 2026-11-16): a shop sells games and,
  // with tables, may also be a place to play; a game space is a place to play that may also sell.
  var VENUE_KINDS = {
    shop: { label: "Tienda", verified: "Tienda verificada" },
    play_space: { label: "Espacio de juegos", verified: "Espacio verificado" },
  };

  // What kind of place a store is; a shop for none (a backend before 073) and for a kind this page does not know.
  function venueKind(store) {
    return VENUE_KINDS.hasOwnProperty(store && store.venue_kind) ? store.venue_kind : "shop";
  }

  // «Espacio de juegos» under a game space's name; a shop says nothing, as in the apps.
  function venueKindLabel(store) {
    var kind = venueKind(store);
    return kind === "shop" ? null : VENUE_KINDS[kind].label;
  }

  // What the check mark says: «Tienda verificada», «Espacio verificado».
  function verifiedLabel(store) {
    return VENUE_KINDS[venueKind(store)].verified;
  }

  // Whether the place sells games: true unless the server says it does not (a backend before 074 never says).
  function sellsGames(store) {
    return !(store && store.sells_games === false);
  }

  // What the place offers, as the apps' chips say it, each only when true and always in this order: «Se juega
  // aquí», «Vende juegos», «Comida y bebida». People play there when the server sends play (it does only for a
  // place where people play, and only once places to play are open to everyone). A shop where nobody plays shows
  // none: it is just a store. The apps' PlaceFact.facts.
  function placeFacts(store, play) {
    var offersPlay = !!play;
    if (venueKind(store) !== "play_space" && !offersPlay) return [];
    return [
      offersPlay ? "Se juega aquí" : null,
      sellsGames(store) ? "Vende juegos" : null,
      offersPlay && play.serves_food === true ? "Comida y bebida" : null,
    ].filter(Boolean);
  }

  // What the page says about playing there: the cost, the house rules and the first games of its «Juegos de la
  // casa», each only when the place wrote it. Null when the server sent no play (nobody plays there, places to
  // play are not open to everyone yet, or a backend before 074).
  function playFacts(play) {
    if (!play) return null;
    var clean = function (value) { return typeof value === "string" && value.trim() ? value.trim() : null; };
    var games = (play.library || []).filter(function (game) { return game && clean(game.name); })
      .map(function (game) { return { name: clean(game.name), note: clean(game.note) }; });
    return {
      fee: clean(play.fee_note),
      rules: clean(play.house_rules),
      games: games,
      count: Math.max(Number(play.library_count) || 0, games.length),
    };
  }

  // ---- The gallery, the menu and the map (P150, migration 082) ---------------------------------------

  // The labels of a place's gallery, as the apps' chips say them, in this order.
  var GALLERY_KINDS = [
    { kind: "place", label: "El lugar" },
    { kind: "events", label: "Eventos" },
    { kind: "activities", label: "Actividades" },
  ];

  // The gallery's photos the server sent (newest first), each {path, kind}; a kind this page does not know reads
  // «El lugar». Empty when there is none (nobody plays there, places to play not open, a backend before 082).
  function galleryPhotos(play) {
    var known = GALLERY_KINDS.map(function (k) { return k.kind; });
    return ((play && play.gallery) || []).filter(function (photo) {
      return photo && typeof photo.path === "string" && photo.path;
    }).map(function (photo) {
      return { path: photo.path, kind: known.indexOf(photo.kind) === -1 ? "place" : photo.kind };
    });
  }

  // The chips over the gallery: «Todas» and each label that has a photo, in the apps' order; none for a gallery
  // with photos of one kind only (nothing to choose).
  function galleryChips(photos) {
    var kinds = GALLERY_KINDS.filter(function (k) {
      return photos.some(function (photo) { return photo.kind === k.kind; });
    });
    if (kinds.length < 2) return [];
    return [{ kind: null, label: "Todas" }].concat(kinds);
  }

  function galleryLabel(kind) {
    var found = GALLERY_KINDS.filter(function (k) { return k.kind === kind; })[0];
    return found ? found.label : GALLERY_KINDS[0].label;
  }

  // «Ver menú»: the place's https link while it serves food (the server sends it only then); null otherwise.
  function menuURL(play) {
    var url = play && play.menu_url;
    return typeof url === "string" && /^https:\/\/[^\s]+$/.test(url) ? url : null;
  }

  // «Ver reseñas en mapas»: the place's own Google Maps link when it pasted one, else the maps search for its
  // name and address (as «Cómo llegar»). Null for an online store, which has no door.
  function reviewsURL(platform, store) {
    if (!store || store.is_online || !store.address) return null;
    var own = store.maps_url;
    if (typeof own === "string" && /^https:\/\/((www\.)?google\.com(\.mx)?\/maps|maps\.google\.com(\.mx)?|maps\.app\.goo\.gl\/|goo\.gl\/maps\/|g\.page\/)/.test(own)) {
      return own;
    }
    return mapsURL(platform, store.name, store.address);
  }

  // ---- Search engines (P154) ------------------------------------------------------------------------

  var SITE = "https://meeplo.com.mx";

  // The address Google keeps: the query form. The shared /t/<slug> is GitHub Pages' 404 page, which redirects.
  function canonicalURL(slug) {
    return SITE + "/t/?s=" + slug;
  }

  // What the place is, in a search result's words: "Espacio de juegos en CDMX", "Tienda de juegos de mesa en
  // Puebla", "Tienda de juegos de mesa en línea".
  function placeSummary(store) {
    if (venueKind(store) === "play_space") return "Espacio de juegos" + (store.city ? " en " + store.city : "");
    if (store.is_online) return "Tienda de juegos de mesa en línea";
    return "Tienda de juegos de mesa" + (store.city ? " en " + store.city : "");
  }

  // "Dados y Meeples · Espacio de juegos en CDMX · Meeplo".
  function searchTitle(store) {
    return store.name + " · " + placeSummary(store) + " · Meeplo";
  }

  // "Espacio de juegos en CDMX: se juega aquí, vende juegos, comida y bebida. <the description>…", at most 160
  // characters.
  function searchDescription(store, play) {
    var facts = placeFacts(store, play).map(function (fact) { return fact.toLowerCase(); });
    var text = placeSummary(store) + (facts.length ? ": " + facts.join(", ") : "") + ".";
    var description = (store.description || "").replace(/\s+/g, " ").trim();
    text += description ? " " + description : " Horario, eventos y juegos en Meeplo.";
    return text.length <= 160 ? text : text.slice(0, 159).replace(/\s+\S*$/, "") + "…";
  }

  var SCHEMA_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // schema.org data for the place: a Store, an EntertainmentBusiness (a game space) or an OnlineStore, with what
  // its page shows. Never its WhatsApp, its coordinates or who runs it. `photoURLs` are absolute addresses.
  function structuredData(store, play, slug, photoURLs, logoURL) {
    var type = store.is_online ? "OnlineStore" : venueKind(store) === "play_space" ? "EntertainmentBusiness" : "Store";
    var data = {
      "@context": "https://schema.org",
      "@type": type,
      name: store.name,
      url: canonicalURL(slug),
    };
    if (store.description) data.description = store.description;
    if (photoURLs && photoURLs.length) data.image = photoURLs;
    if (logoURL) data.logo = logoURL;
    if (!store.is_online && store.address) {
      data.address = { "@type": "PostalAddress", streetAddress: store.address, addressCountry: "MX" };
      if (store.city) data.address.addressLocality = store.city;
      var hours = (store.hours || []).filter(function (d) { return d && d.day >= 1 && d.day <= 7; });
      if (hours.length) {
        data.openingHoursSpecification = hours.map(function (d) {
          return {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: "https://schema.org/" + SCHEMA_DAYS[d.day - 1],
            opens: clock(minutes(d.opens)),
            closes: d.closes === "24:00" ? "23:59" : clock(minutes(d.closes)),
          };
        });
      }
      var map = reviewsURL("other", store);
      if (map) data.hasMap = map;
    }
    var sameAs = [store.website, store.instagram ? instagramURL(store.instagram) : null].filter(Boolean);
    if (sameAs.length) data.sameAs = sameAs;
    var menu = menuURL(play);
    if (menu) data.hasMenu = menu;
    return data;
  }

  // «Para mayores de 18 años · Organiza: Dados y Meeples», under every event: the business hosts it, not Meeplo.
  function organiserLine(storeName) {
    return "Para mayores de 18 años · Organiza: " + storeName;
  }

  return {
    galleryPhotos: galleryPhotos,
    galleryChips: galleryChips,
    galleryLabel: galleryLabel,
    menuURL: menuURL,
    reviewsURL: reviewsURL,
    canonicalURL: canonicalURL,
    placeSummary: placeSummary,
    searchTitle: searchTitle,
    searchDescription: searchDescription,
    structuredData: structuredData,
    venueKindLabel: venueKindLabel,
    verifiedLabel: verifiedLabel,
    sellsGames: sellsGames,
    placeFacts: placeFacts,
    playFacts: playFacts,
    organiserLine: organiserLine,
    parseSlug: parseSlug,
    pathSlug: pathSlug,
    pathRedirect: pathRedirect,
    normalizeSlug: normalizeSlug,
    shareURL: shareURL,
    storePhotoURL: storePhotoURL,
    openStatus: openStatus,
    openStatusText: openStatusText,
    weekRows: weekRows,
    eventDate: eventDate,
    placesLeftText: placesLeftText,
    countLabel: countLabel,
    mapsURL: mapsURL,
    instagramURL: instagramURL,
    androidIntentURL: androidIntentURL,
    appSchemeURL: appSchemeURL,
    brandColor: brandColor,
  };
});
