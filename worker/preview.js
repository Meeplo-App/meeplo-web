// Link previews for shared listings and stores (Meeplo-iOS, "Public Listing Page Proposal/Link Previews.md"):
// what the Cloudflare Worker writes into a page's <head> so WhatsApp, iMessage and the like show the game's photo,
// title and price instead of the mascot. Pure: no network and no HTMLRewriter, so `node --test` covers it.
//
// Titles and descriptions come from the page's own rules (listing-rules.js, store-rules.js), so Google, the page
// and the preview read the same words. Never the seller: no username, avatar, meeting places or distance.
"use strict";

var MASCOT = "https://meeplo.com.mx/assets/meeplo.png";

// What a request to /l/ or /t/ asks for:
//   { kind: "redirect", location }  the two link forms GitHub Pages answers with 404.html, /l/<uuid> and
//                                   /t/<slug>, sent where 404.html's script sends a browser;
//   { kind: "listing", id }         /l/?id=<uuid>;
//   { kind: "store", slug }         /t/?s=<slug>;
//   null                            anything else, served as GitHub Pages serves it.
function route(pathname, search, listingRules, storeRules) {
  var oldId = listingRules.oldPathListingId(pathname);
  if (oldId) return { kind: "redirect", location: "/l/?id=" + oldId };
  var storePath = storeRules.pathRedirect(pathname, search);
  if (storePath) return { kind: "redirect", location: storePath };
  if (pathname === "/l/") {
    var id = listingRules.parseListingId(search);
    return id ? { kind: "listing", id: id } : null;
  }
  if (pathname === "/t/") {
    var slug = storeRules.parseSlug(search);
    return slug ? { kind: "store", slug: slug } : null;
  }
  return null;
}

// The preview of a listing from browse_listing_page's bundle: the card copy of its first photo (640 px, small
// enough for WhatsApp), else the mascot. Null when the bundle has no listing.
function listingTags(bundle, id, listingRules, apiURL) {
  var listing = bundle && bundle.listing;
  if (!listing || !listing.title) return null;
  var photo = (bundle.photos || [])[0];
  var path = photo && (photo.card_path || photo.storage_path);
  return {
    title: listingRules.searchTitle(listing),
    description: listingRules.searchDescription(listing),
    url: listingRules.canonicalURL(id),
    image: path ? listingRules.photoURL(apiURL, path) : MASCOT,
    imageType: path ? "image/jpeg" : "image/png",
    imageAlt: path ? "Foto de " + listing.title : "La mascota amarilla de Meeplo sobre un fondo morado",
    large: Boolean(path),
  };
}

// The preview of a store from browse_store_page's answer: its cover, else its logo, else the mascot. Null when
// the answer has no store.
function storeTags(page, slug, storeRules, apiURL) {
  var store = page && page.store;
  if (!store || !store.name) return null;
  var path = store.cover_photo_path || store.logo_path;
  return {
    title: storeRules.searchTitle(store),
    description: storeRules.searchDescription(store, page.play),
    url: storeRules.canonicalURL(slug),
    image: path ? storeRules.storePhotoURL(apiURL, path) : MASCOT,
    imageType: path ? "image/jpeg" : "image/png",
    imageAlt: path ? (store.cover_photo_path ? "Foto de " : "Logo de ") + store.name : "La mascota amarilla de Meeplo sobre un fondo morado",
    large: Boolean(store.cover_photo_path),
  };
}

// The edits to the page's <head>, as data: `set` changes the content of a tag the page already has (matched by
// its CSS selector), `remove` drops tags that no longer apply (the mascot's fixed size), `append` adds what the
// static page lacks. The Worker applies them with HTMLRewriter.
function headEdits(tags) {
  var set = [
    { selector: 'meta[name="description"]', value: tags.description },
    { selector: 'meta[property="og:title"]', value: tags.title },
    { selector: 'meta[property="og:description"]', value: tags.description },
    { selector: 'meta[property="og:image"]', value: tags.image },
    { selector: 'meta[property="og:image:type"]', value: tags.imageType },
    { selector: 'meta[property="og:image:alt"]', value: tags.imageAlt },
    { selector: 'meta[name="twitter:card"]', value: tags.large ? "summary_large_image" : "summary" },
    { selector: 'meta[name="twitter:title"]', value: tags.title },
    { selector: 'meta[name="twitter:description"]', value: tags.description },
    { selector: 'meta[name="twitter:image"]', value: tags.image },
    { selector: 'meta[name="twitter:image:alt"]', value: tags.imageAlt },
  ];
  var remove = tags.image === MASCOT ? [] : ['meta[property="og:image:width"]', 'meta[property="og:image:height"]'];
  var append =
    '<meta property="og:url" content="' + escapeAttribute(tags.url) + '">' +
    '<link rel="canonical" href="' + escapeAttribute(tags.url) + '">';
  return { title: tags.title, set: set, remove: remove, append: append };
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

module.exports = {
  MASCOT: MASCOT,
  route: route,
  listingTags: listingTags,
  storeTags: storeTags,
  headEdits: headEdits,
  escapeAttribute: escapeAttribute,
};
