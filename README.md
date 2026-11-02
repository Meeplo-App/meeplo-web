# meeplo-web

The site at `https://meeplo.com.mx`: the landing page, the legal pages, `.well-known/` (Universal Links
and Android App Links) and the public listing page. Plain HTML, CSS and JavaScript, no build step,
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
- `404.html` — the generic page for unknown paths; it redirects the old link form `/l/<uuid>` to `/l/?id=`.

### Trying it locally

```sh
python3 -m http.server 8080
open "http://localhost:8080/l/?id=<uuid>&env=staging"
```

The production page talks to production, so it goes live only once migration 050 is promoted there.
