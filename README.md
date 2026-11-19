# meeplo-web

The site at `https://meeplo.com.mx`: the landing page, the legal pages, `.well-known/` (Universal Links
and Android App Links), the public listing page and the public store page. Plain HTML, CSS and JavaScript, no build step,
deployed by GitHub Pages from `main`.

## The public listing page — `/l/?id=<uuid>`

The link the app shares. With Meeplo installed it opens the app (the files in `.well-known/` make the
link verified on both platforms). Without the app the browser lands here, and `l/index.html` shows the
listing **read-only**, in one of three states:

| State | When | What shows |
| --- | --- | --- |
| Listing | the server answers | photos, title, price, condition, description, the seller's name, badges and rating, the meeting places' names |
| Not available | held, sold, withdrawn, suspended seller, unknown id | "Este anuncio ya no está disponible." and the store buttons |
| Generic | no id, a malformed id, or the request failed | the original page |

Every button that needs an account — *Enviar mensaje*, the heart, the seller — opens a **download
sheet**; nothing on the page navigates inside Meeplo. A sticky **banner** offers the App Store on iPhone
and iPad, Google Play on Android (plus *Abrir en la app* through an `intent://` URL), both elsewhere.
The page reads one listing per load through the Supabase RPC `browse_listing_page` with the publishable
key, and never writes.

- `assets/listing-rules.js` — pure rules (id parsing, platform detection, price and date formatting,
  URLs, the app's Spanish labels). Tested: `node --test`, run from the repository root (Node 22 or later finds `tests/*.test.mjs` itself).
- `assets/listing.js` — the page: the request, rendering, the banner and the sheet. The backends are at
  the top; `?env=staging` or `?env=local` switch them **only on localhost**.
- `assets/listing.css` — the page's styles (also the 404 page's).
- `404.html` — the generic page for unknown paths; it redirects the old link form `/l/<uuid>` to `/l/?id=`,
  and a store's link `/t/<slug>` to `/t/?s=<slug>`.

### Trying it locally

```sh
python3 -m http.server 8080
open "http://localhost:8080/l/?id=<uuid>&env=staging"
```

### Google

The listing page can appear in Google's results. Google runs the page's JavaScript, so what
`assets/listing.js` sets once a listing loads is what it indexes:

- **Title:** «Catan usado · $650 · Meeplo» («sellado» for a sealed copy).
- **Description:** «Catan, buen estado, por $650 MXN en Meeplo.» followed by the listing's description, cut at 160 characters.
- **Canonical address:** `https://meeplo.com.mx/l/?id=<uuid>`, whatever else the shared link carried (`utm_…`, `env`).
- **Structured data:** a schema.org `Product` with one `Offer` (price, MXN, in stock, used or new), so a result can show the price.
- **`robots`:** the static HTML has none, so a listing is indexable; the *not available* and *generic* states add `noindex`, so a sold or withdrawn listing leaves the results.
- **The seller is never in it:** not in the title, the description or the structured data, and their block is `data-nosnippet`.
  The page still shows their username to visitors, as before.

The rules are in `assets/listing-rules.js` (`searchTitle`, `searchDescription`, `canonicalURL`, `structuredData`)
and tested with the others. The store page (`/t/`) and `404.html` keep `noindex`.

The sitemap is Meeplo-iOS's `sitemap` Edge Function, which lists every listing the page shows when a search engine
asks; `robots.txt` names its production address (Google accepts a sitemap on another host that way). The owner's step is Google Search Console: verify `meeplo.com.mx`,
then inspect a listing's address with *URL Inspection* to see the page as Google rendered it.

The production page talks to production, so it goes live only once migration 050 is promoted there.

## The public catalog page — `/buscar/`

The listings a visitor without the app can open, so search engines reach every listing from the site itself (the
sitemap lives on another host, and until this page nothing here linked to a listing). Linked from the home page (the
menu, «Buscar juegos», and the hero, «Ver juegos en venta») and from every listing page («Ver más juegos en venta»).

- **What shows:** 24 listings per page, most recently changed first, each a card — cover, title, condition and category
  in the app's words («Expansión» when it is one), price — that links to `/l/?id=<uuid>`. A search box (`?q=`) matches
  the title without accents or case. «Anterior» and «Siguiente» (`?pagina=N`). Never the seller, the meeting places or
  the description.
- **States:** the cards; «No encontramos ese juego.» for a search with no match (or «Todavía no hay juegos en venta.»);
  «No pudimos cargar los juegos.» when the request fails (and `noindex`).
- **Data:** one call per load to the Supabase RPC `browse_catalog_page` (Meeplo-iOS migration 081) with the publishable
  key, read-only, by `browse_listing_page`'s rule: a card always opens. It deploys only once 081 is in production.
- **Google:** the catalog's pages are indexable, each with its own canonical address (`/buscar/`, `/buscar/?pagina=2`),
  title «Juegos de mesa en venta en México, usados y sellados · Meeplo» and a schema.org `ItemList` of its cards. A search is
  `noindex, follow` with the catalog as its canonical address.
- `assets/catalog-rules.js` — pure rules (the address, paging, titles, the card's text, structured data), tested with
  `node --test`; `assets/catalog.js` — the page; `assets/catalog.css` — its styles, on top of `listing.css`.
- **Trying it locally:** `?env=staging` or `?env=local` as on the listing page, only on localhost; with `env=local`,
  `&port=55321` points it at a UI-test lane's stack.

## The public store page — `/t/<slug>`

The link the apps share for a store, and the one its poster's QR code holds: `https://meeplo.com.mx/t/<slug>`,
the store's short name, which the Meeplo team gives each approved store. With Meeplo installed it opens the
store in the app (`/t/*` is in both `.well-known` files' scope: the Universal Links' components and the
Android manifest's path). GitHub Pages has no file at that path, so `404.html` sends it on to the page's
query form, `/t/?s=<slug>`, and `t/index.html` shows the store **read-only**:

| State | When | What shows |
| --- | --- | --- |
| Store | the server answers | the cover in the store's colour (a Pro store's own, with its photo), logo, name, «Tienda verificada» or the Pro seal, description; whether it is open now, city and address, «Cómo llegar» (a maps search by name and address, never a position), website, Instagram, the week's hours; its photos; its five soonest events; twelve of its games for sale with prices («En venta») |
| Not available | not approved, not public, suspended, an unknown slug | "Esta tienda no está disponible." and the store buttons |
| Generic | no slug, a malformed one, or the request failed | the original page, worded for a store |

Never its WhatsApp, its coordinates or any id: the RPC does not return them. Every account action —
apartar lugar, a game, *Ver los N juegos en la app*, *Ver la tienda en la app* — opens the **download sheet**;
the store's website, Instagram and the maps search are its only links out. The page reads one store per load
through the Supabase RPC `browse_store_page` (migration 069) with the publishable key, and never writes.

**Places to play** (migrations 073–075). A place is a «Tienda» (`venue_kind` `shop`) or an «Espacio de juegos»
(`play_space`). The page asks with `p_with_play_places: true`, so the server may answer with a game space, which it
does only once the flag `lugares_para_jugar` is open to everyone; until then such a link shows "no está
disponible", as before. The page then says the kind under a game space's name («Espacio de juegos», «Espacio
verificado»; a shop says nothing new), the apps' chips under the opening status — «Se juega aquí», «Vende juegos»,
«Comida y bebida», in that order, each only when true, none for a shop where nobody plays — «Para jugar aquí»
(the cost to play and the house rules, in the place's words) with the first twelve of its «Juegos de la casa»,
and every event carries «Para mayores de 18 años · Organiza: {negocio}». The games for sale are «En venta»; a place
that does not sell (`store.sells_games` false, and the server sends no listings) has no such section.
A backend before 074 has no `p_with_play_places` (PostgREST answers `PGRST202`): the page asks again with the
slug alone and, with none of the new fields, shows a plain store. Merge only once production has 073–075.

- `assets/store-rules.js` — pure rules (slug parsing and the 404 redirect, opening hours as the apps read
  them, event dates in the store's time zone, places left, maps and app links, the store's colour). Tested
  with `node --test` from the repository root, with the listing page's.
- `assets/store.js` — the page; the backends at the top, `?env=staging` or `?env=local` **only on localhost**.
- `assets/store.css` — its styles, on top of `assets/listing.css`.

```sh
python3 -m http.server 8080
open "http://localhost:8080/t/?s=<slug>&env=staging"
```

**It goes live only once migration 069 is promoted to production**: merging this repository publishes the
page, and against a production without 069 every store link would show the generic page.
