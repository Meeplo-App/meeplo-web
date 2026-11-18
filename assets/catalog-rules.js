// Pure rules for the public catalog page (/buscar/): no DOM, no network. Loaded by the page as a script (it sets
// window.MeeploCatalog) and by `node --test tests/` as a CommonJS module. Uses listing-rules.js for prices and labels.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./listing-rules.js"));
  else root.MeeploCatalog = factory(root.MeeploListing);
})(typeof self !== "undefined" ? self : this, function (listing) {
  "use strict";

  var SITE = "https://meeplo.com.mx";
  var PAGE_SIZE = 24;
  var MAX_QUERY = 80;
  // browse_catalog_page clamps p_offset to 10,000; past that a page would repeat the last one.
  var MAX_PAGE = Math.floor(10000 / PAGE_SIZE) + 1;

  // {query, page} from the address: `q` trimmed, spaces collapsed, at most 80 characters ("" when none);
  // `pagina` a whole number from 1 to MAX_PAGE (1 when missing or malformed).
  function parseSearch(search) {
    var params = new URLSearchParams(search || "");
    var query = (params.get("q") || "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY).trim();
    var raw = params.get("pagina");
    var page = /^\d{1,4}$/.test(raw || "") ? parseInt(raw, 10) : 1;
    if (page < 1) page = 1;
    if (page > MAX_PAGE) page = MAX_PAGE;
    return { query: query, page: page };
  }

  // The RPC's arguments for a page.
  function rpcArguments(state) {
    return { p_query: state.query || null, p_limit: PAGE_SIZE, p_offset: (state.page - 1) * PAGE_SIZE };
  }

  function pageCount(total) {
    return Math.max(1, Math.min(MAX_PAGE, Math.ceil((total || 0) / PAGE_SIZE)));
  }

  // The page's relative address for a state: "./", "./?pagina=2", "./?q=catan", "./?q=catan&pagina=2".
  function pageHref(query, page) {
    var params = new URLSearchParams();
    if (query) params.set("q", query);
    if (page > 1) params.set("pagina", String(page));
    var text = params.toString();
    return "./" + (text ? "?" + text : "");
  }

  // Where Google should keep the page: the plain catalog's pages are their own; a search is never indexed
  // (see robotsContent), so it points to the catalog.
  function canonicalURL(state) {
    if (state.query) return SITE + "/buscar/";
    return SITE + "/buscar/" + (state.page > 1 ? "?pagina=" + state.page : "");
  }

  // "noindex, follow" for a search (endless thin variations of the catalog); null, indexable, otherwise.
  function robotsContent(state) {
    return state.query ? "noindex, follow" : null;
  }

  function pageSuffix(page) { return page > 1 ? " · página " + page : ""; }

  // "Juegos de mesa usados en venta en México · Meeplo", "«Catan»: juegos usados · Meeplo", with " · página N".
  function documentTitle(state) {
    if (state.query) return "«" + state.query + "»: juegos de mesa usados" + pageSuffix(state.page) + " · Meeplo";
    return "Juegos de mesa usados en venta en México" + pageSuffix(state.page) + " · Meeplo";
  }

  // "1 juego", "24 juegos", "1,250 juegos".
  function countText(total) {
    var n = total || 0;
    return new Intl.NumberFormat("en-US").format(n) + (n === 1 ? " juego" : " juegos");
  }

  // The line above the grid: "190 juegos en venta", "3 juegos para «catan»", "Página 2 de 8 · 190 juegos en venta".
  function summaryText(state, total) {
    var base = state.query ? countText(total) + " para «" + state.query + "»" : countText(total) + " en venta";
    var pages = pageCount(total);
    return pages > 1 ? "Página " + state.page + " de " + pages + " · " + base : base;
  }

  // A card's second line: "Buen estado · Familiar", "Sellado · Estrategia · Expansión".
  function cardDetails(item) {
    var parts = [];
    var condition = listing.labels.condition[item.condition];
    var category = listing.labels.category[item.category];
    if (condition) parts.push(condition);
    if (category) parts.push(category);
    if (item.is_expansion) parts.push("Expansión");
    return parts.join(" · ");
  }

  function cardPrice(item) {
    return listing.formatPrice(item.price_amount, item.price_currency);
  }

  // The listing's own page; the canonical address its page declares.
  function listingURL(item) {
    return listing.canonicalURL(item.id);
  }

  // The image alt text: "Catan, usado" / "Catan, sellado".
  function imageAlt(item) {
    return item.title + (item.condition === "sealed" ? ", sellado" : ", usado");
  }

  // schema.org ItemList of the page's listings, in order: what lets a search engine read it as a list of products.
  function structuredData(state, items) {
    var offset = (state.page - 1) * PAGE_SIZE;
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: state.query ? "Juegos de mesa usados: " + state.query : "Juegos de mesa usados en venta en México",
      url: canonicalURL(state),
      numberOfItems: items.length,
      itemListElement: items.map(function (item, index) {
        return { "@type": "ListItem", position: offset + index + 1, url: listingURL(item), name: item.title };
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
    canonicalURL: canonicalURL,
    robotsContent: robotsContent,
    documentTitle: documentTitle,
    countText: countText,
    summaryText: summaryText,
    cardDetails: cardDetails,
    cardPrice: cardPrice,
    listingURL: listingURL,
    imageAlt: imageAlt,
    structuredData: structuredData,
  };
});
