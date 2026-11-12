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

  return {
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
