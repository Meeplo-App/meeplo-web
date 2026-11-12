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

The production page talks to production, so it goes live only once migration 050 is promoted there.

## The public store page — `/t/<slug>`

The link the apps share for a store, and the one its poster's QR code holds: `https://meeplo.com.mx/t/<slug>`,
the store's short name, which the Meeplo team gives each approved store. With Meeplo installed it opens the
store in the app (`/t/*` is in both `.well-known` files' scope: the Universal Links' components and the
Android manifest's path). GitHub Pages has no file at that path, so `404.html` sends it on to the page's
query form, `/t/?s=<slug>`, and `t/index.html` shows the store **read-only**:

| State | When | What shows |
| --- | --- | --- |
| Store | the server answers | the cover in the store's colour (a Pro store's own, with its photo), logo, name, «Tienda verificada» or the Pro seal, description; whether it is open now, city and address, «Cómo llegar» (a maps search by name and address, never a position), website, Instagram, the week's hours; its photos; its five soonest events; twelve of its games for sale with prices |
| Not available | not approved, not public, suspended, an unknown slug | "Esta tienda no está disponible." and the store buttons |
| Generic | no slug, a malformed one, or the request failed | the original page, worded for a store |

Never its WhatsApp, its coordinates or any id: the RPC does not return them. Every account action —
apartar lugar, a game, *Ver los N juegos en la app*, *Ver la tienda en la app* — opens the **download sheet**;
the store's website, Instagram and the maps search are its only links out. The page reads one store per load
through the Supabase RPC `browse_store_page` (migration 069) with the publishable key, and never writes.

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
