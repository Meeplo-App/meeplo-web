// Pure rules for the public directory of places (/lugares/, P154): no DOM, no network. Loaded by the page as a script
// (it sets window.MeeploPlaces) and by `node --test tests/` as a CommonJS module. Uses store-rules.js for what a place's
// own page says the same way (its kind, its facts, its address and photos).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./store-rules.js"));
  else root.MeeploPlaces = factory(root.MeeploStore);
})(typeof self !== "undefined" ? self : this, function (store) {
  "use strict";

  var SITE = "https://meeplo.com.mx";
  var PAGE_SIZE = 24;
  var MAX_QUERY = 80;
  // browse_places_page clamps p_offset to 10,000; past that a page would repeat the last one.
  var MAX_PAGE = Math.floor(10000 / PAGE_SIZE) + 1;
  // The chips, in this order: the address's `tipo` and the RPC's p_kind.
  var KINDS = [
    { tipo: null, kind: null, label: "Todos" },
    { tipo: "tiendas", kind: "shop", label: "Tiendas" },
    { tipo: "espacios", kind: "play_space", label: "Espacios de juegos" },
  ];

  function kindOf(tipo) {
    return KINDS.filter(function (k) { return k.tipo === tipo; })[0] || KINDS[0];
  }

  // {query, tipo, page} from the address: `q` trimmed, spaces collapsed, at most 80 characters ("" when none);
  // `tipo` "tiendas" or "espacios" (null otherwise); `pagina` a whole number from 1 to MAX_PAGE (1 when missing).
  function parseSearch(search) {
    var params = new URLSearchParams(search || "");
    var query = (params.get("q") || "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY).trim();
    var tipo = kindOf(params.get("tipo")).tipo;
    var raw = params.get("pagina");
    var page = /^\d{1,4}$/.test(raw || "") ? parseInt(raw, 10) : 1;
    if (page < 1) page = 1;
    if (page > MAX_PAGE) page = MAX_PAGE;
    return { query: query, tipo: tipo, page: page };
  }

  // The RPC's arguments for a page.
  function rpcArguments(state) {
    return {
      p_query: state.query || null,
      p_kind: kindOf(state.tipo).kind,
      p_limit: PAGE_SIZE,
      p_offset: (state.page - 1) * PAGE_SIZE,
    };
  }

  function pageCount(total) {
    return Math.max(1, Math.min(MAX_PAGE, Math.ceil((total || 0) / PAGE_SIZE)));
  }

  // The page's relative address for a state: "./", "./?tipo=espacios", "./?q=cdmx&pagina=2".
  function pageHref(query, tipo, page) {
    var params = new URLSearchParams();
    if (query) params.set("q", query);
    if (tipo) params.set("tipo", tipo);
    if (page > 1) params.set("pagina", String(page));
    var text = params.toString();
    return "./" + (text ? "?" + text : "");
  }

  // The chips: each with its address (keeping the search, back to the first page) and whether it is the current one.
  function chips(state) {
    return KINDS.map(function (k) {
      return { label: k.label, href: pageHref(state.query, k.tipo, 1), current: k.tipo === state.tipo };
    });
  }

  // Where Google should keep the page: the directory's pages, and each kind's, are their own; a search is never
  // indexed (see robotsContent), so it points to the directory of its kind.
  function canonicalURL(state) {
    var params = new URLSearchParams();
    if (state.tipo) params.set("tipo", state.tipo);
    if (!state.query && state.page > 1) params.set("pagina", String(state.page));
    var text = params.toString();
    return SITE + "/lugares/" + (text ? "?" + text : "");
  }

  // "noindex, follow" for a search (endless thin variations); null, indexable, otherwise.
  function robotsContent(state) {
    return state.query ? "noindex, follow" : null;
  }

  var HEADINGS = {
    null: "Tiendas de juegos de mesa y espacios para jugar",
    tiendas: "Tiendas de juegos de mesa",
    espacios: "Espacios de juegos de mesa: dónde jugar",
  };

  function pageSuffix(page) { return page > 1 ? " · página " + page : ""; }

  // "Tiendas de juegos de mesa y espacios para jugar en México · Meeplo", "«cdmx»: tiendas y espacios de juegos ·
  // Meeplo", each kind its own, with " · página N".
  function documentTitle(state) {
    if (state.query) return "«" + state.query + "»: tiendas y espacios de juegos" + pageSuffix(state.page) + " · Meeplo";
    return HEADINGS[state.tipo] + " en México" + pageSuffix(state.page) + " · Meeplo";
  }

  // The page's heading, by kind.
  function heading(state) {
    return HEADINGS[state.tipo];
  }

  // "1 lugar", "24 lugares", "1,250 lugares".
  function countText(total) {
    var n = total || 0;
    return new Intl.NumberFormat("en-US").format(n) + (n === 1 ? " lugar" : " lugares");
  }

  // The line above the grid: "12 lugares", "3 lugares para «cdmx»", "Página 2 de 3 · 60 lugares".
  function summaryText(state, total) {
    var base = state.query ? countText(total) + " para «" + state.query + "»" : countText(total);
    var pages = pageCount(total);
    return pages > 1 ? "Página " + state.page + " de " + pages + " · " + base : base;
  }

  // What the card says under the name: "Espacio de juegos · CDMX", "Tienda · Puebla", "Tienda en línea".
  function cardLine(item) {
    if (item.is_online) return "Tienda en línea";
    var kind = store.venueKindLabel(item) || "Tienda";
    return item.city ? kind + " · " + item.city : kind;
  }

  // The card's chips, as the place's own page says them (store-rules placeFacts): none for a shop where nobody plays.
  function cardFacts(item) {
    return store.placeFacts(item, item.offers_play ? { serves_food: item.serves_food === true } : null);
  }

  // The place's own page: the canonical address it declares.
  function placeURL(item) {
    return store.canonicalURL(item.slug);
  }

  // The card's picture: its card photo, else its logo, else null (the page draws the initial on the colour).
  function imagePath(item) {
    return item.photo_path || item.logo_path || null;
  }

  function initial(item) {
    return (item.name || "").trim().charAt(0).toUpperCase();
  }

  // schema.org ItemList of the page's places, in order.
  function structuredData(state, items) {
    var offset = (state.page - 1) * PAGE_SIZE;
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: state.query ? "Tiendas y espacios de juegos: " + state.query : HEADINGS[state.tipo] + " en México",
      url: canonicalURL(state),
      numberOfItems: items.length,
      itemListElement: items.map(function (item, index) {
        return { "@type": "ListItem", position: offset + index + 1, url: placeURL(item), name: item.name };
      }),
    };
  }

  return {
    PAGE_SIZE: PAGE_SIZE,
    MAX_PAGE: MAX_PAGE,
    parseSearch: parseSearch,
    rpcArguments: rpcArguments,
    pageCount: pageCount,
    pageHref: pageHref,
    chips: chips,
    canonicalURL: canonicalURL,
    robotsContent: robotsContent,
    documentTitle: documentTitle,
    heading: heading,
    countText: countText,
    summaryText: summaryText,
    cardLine: cardLine,
    cardFacts: cardFacts,
    placeURL: placeURL,
    imagePath: imagePath,
    initial: initial,
    structuredData: structuredData,
  };
});
