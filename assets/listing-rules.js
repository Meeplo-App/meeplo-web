// Pure rules for the public listing page: no DOM, no network. Loaded by the page as a script (it sets
// window.MeeploListing) and by `node --test tests/` as a CommonJS module.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MeeploListing = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  var OLD_PATH = /^\/l\/([0-9a-fA-F-]{36})\/?$/;

  // The `id` query value as a lowercase uuid, or null when missing or malformed.
  function parseListingId(search) {
    var value = new URLSearchParams(search || "").get("id");
    if (!value) return null;
    value = value.toLowerCase();
    return UUID.test(value) ? value : null;
  }

  // The uuid in the old link form /l/<uuid>, which the app still accepts; null otherwise.
  function oldPathListingId(pathname) {
    var match = OLD_PATH.exec(pathname || "");
    if (!match) return null;
    var value = match[1].toLowerCase();
    return UUID.test(value) ? value : null;
  }

  // 'ios', 'android' or 'other'. iPadOS Safari presents a Mac user agent, hence the touch-points check.
  function detectPlatform(env) {
    var ua = env.userAgent || "";
    var platform = env.uaPlatform || "";
    var touches = env.maxTouchPoints || 0;
    if (/Android/i.test(platform)) return "android";
    if (/^(iOS|iPadOS)$/i.test(platform)) return "ios";
    if (/iPhone|iPod|iPad/.test(ua)) return "ios";
    if (/Macintosh/.test(ua) && touches > 1) return "ios";
    if (/Android/.test(ua)) return "android";
    return "other";
  }

  // "$650", "$1,250", "$99.50"; the code appended only when it is not MXN: "$10 USD".
  function formatPrice(amount, currency) {
    var number = typeof amount === "number" ? amount : parseFloat(amount);
    var whole = Number.isInteger(number);
    var text = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(number);
    return "$" + text + (currency && currency !== "MXN" ? " " + currency : "");
  }

  // "hoy", "ayer", "hace N días", from 30 days "hace N meses", by calendar day in UTC.
  function relativeDays(iso, now) {
    var day = 24 * 60 * 60 * 1000;
    var then = Date.UTC.apply(null, ymd(new Date(iso)));
    var today = Date.UTC.apply(null, ymd(now || new Date()));
    var days = Math.round((today - then) / day);
    if (days <= 0) return "hoy";
    if (days === 1) return "ayer";
    if (days < 30) return "hace " + days + " días";
    var months = Math.floor(days / 30);
    return months === 1 ? "hace 1 mes" : "hace " + months + " meses";
  }

  function ymd(date) {
    return [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()];
  }

  function publicURL(apiURL, bucket, path) {
    return apiURL.replace(/\/$/, "") + "/storage/v1/object/public/" + bucket + "/" + path;
  }
  function photoURL(apiURL, path) { return publicURL(apiURL, "listing-photos", path); }
  function avatarURL(apiURL, path) { return publicURL(apiURL, "avatars", path); }

  var storeURLs = {
    ios: "https://apps.apple.com/mx/app/meeplo/id6824672527",
    android: "https://play.google.com/store/apps/details?id=com.meeplo.meeploapp",
  };

  // Opens the app on Android when Chrome did not verify the App Link; falls back to the page itself.
  function androidIntentURL(pageURL) {
    var url = new URL(pageURL);
    var id = parseListingId(url.search);
    return "intent://meeplo.com.mx/l/?id=" + id +
      "#Intent;scheme=https;package=com.meeplo.meeploapp;S.browser_fallback_url=" +
      encodeURIComponent(pageURL) + ";end";
  }

  // ---- Search engines ----------------------------------------------------------------------------
  // What Google reads once the page has rendered a listing. Never the seller: their name stays out of
  // the title, the description and the structured data, and the page marks their block data-nosnippet.

  var SITE = "https://meeplo.com.mx";

  // The one address Google should keep for a listing, whatever parameters the shared link carried.
  function canonicalURL(id) {
    return SITE + "/l/?id=" + id;
  }

  // "Catan usado · $650 · Meeplo"; a sealed copy reads "sellado".
  function searchTitle(listing) {
    var state = listing.condition === "sealed" ? "sellado" : "usado";
    return listing.title + " " + state + " · " + formatPrice(listing.price_amount, listing.price_currency) + " · Meeplo";
  }

  // The listing's state as the app names it: "Buen estado"; a sealed copy with a note on its box reads
  // "Sellado, caja con detalles".
  function conditionLabel(listing) {
    if (listing.condition === "sealed" && listing.box_note) return "Sellado, caja con detalles";
    return labels.condition[listing.condition] || listing.condition || "";
  }

  // "Catan, buen estado, por $650 MXN en Meeplo. <the description>…", at most 160 characters.
  function searchDescription(listing) {
    var condition = conditionLabel(listing).toLowerCase();
    var price = formatPrice(listing.price_amount, listing.price_currency);
    if (!listing.price_currency || listing.price_currency === "MXN") price += " MXN";
    var text = listing.title + (condition ? ", " + condition + "," : "") + " por " + price + " en Meeplo.";
    var description = (listing.description || "").replace(/\s+/g, " ").trim();
    if (description) text += " " + description;
    return text.length <= 160 ? text : text.slice(0, 159).replace(/\s+\S*$/, "") + "…";
  }

  // schema.org Product with one Offer: what lets Google show the price and condition in a result.
  function structuredData(listing, id, photoURLs) {
    var data = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: listing.title,
      url: canonicalURL(id),
      offers: {
        "@type": "Offer",
        url: canonicalURL(id),
        price: String(typeof listing.price_amount === "number" ? listing.price_amount : parseFloat(listing.price_amount)),
        priceCurrency: listing.price_currency || "MXN",
        availability: "https://schema.org/InStock",
        itemCondition: listing.condition === "sealed" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
      },
    };
    if (photoURLs && photoURLs.length) data.image = photoURLs;
    var description = (listing.description || "").replace(/\s+/g, " ").trim();
    if (description) data.description = description;
    return data;
  }

  // The app's Spanish wording (Meeplo-iOS ListingLabels.swift and ConditionBadge.swift).
  var labels = {
    condition: { sealed: "Sellado", like_new: "Como nuevo", good: "Buen estado", acceptable: "Aceptable" },
    category: {
      family: "Familiar", strategy: "Estrategia", party: "Fiesta", thematic: "Temático", abstract: "Abstracto",
      customizable: "Cartas coleccionables", childrens: "Infantil", wargame: "Wargame", other: "Otro",
    },
    language: {
      es: "Español", en: "Inglés", fr: "Francés", de: "Alemán", other: "Otro", independent: "Independiente del idioma",
    },
    placeKind: {
      transit: "Transporte público", park: "Parque público", mall: "Centro comercial", shop: "Local comercial",
      cafe: "Café", other: null,
    },
    badge: { meeplo_team: "Equipo Meeplo", founder_seller: "Sello fundador", verified_store: "Tienda verificada" },
  };

  return {
    parseListingId: parseListingId,
    oldPathListingId: oldPathListingId,
    detectPlatform: detectPlatform,
    formatPrice: formatPrice,
    relativeDays: relativeDays,
    photoURL: photoURL,
    avatarURL: avatarURL,
    androidIntentURL: androidIntentURL,
    storeURLs: storeURLs,
    canonicalURL: canonicalURL,
    searchTitle: searchTitle,
    conditionLabel: conditionLabel,
    searchDescription: searchDescription,
    structuredData: structuredData,
    labels: labels,
  };
});
