// Cloudflare Worker in front of GitHub Pages, on meeplo.com.mx/l/* and meeplo.com.mx/t/* only (wrangler.toml).
// It serves GitHub Pages' page with the listing's or the store's own preview tags, so a shared link shows its
// photo, title and price. Whatever goes wrong — an unknown or sold listing, a hidden store, a slow or failing
// backend — it returns the page exactly as GitHub Pages served it: the worst case is today's generic preview.
// Every visitor gets the same HTML; nothing depends on who asks (no user-agent checks: that would be cloaking).
import listingRules from "../assets/listing-rules.js";
import storeRules from "../assets/store-rules.js";
import preview from "./preview.js";

const TIMEOUT_MS = 1500;
const CACHE_SECONDS = 300;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") return fetch(request);

    const target = preview.route(url.pathname, url.search, listingRules, storeRules);
    if (target && target.kind === "redirect") return Response.redirect(url.origin + target.location, 301);
    if (!target || request.method === "HEAD") return fetch(originRequest(request, url, env));

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const [page, tags] = await Promise.all([
      fetch(originRequest(request, url, env, true)),
      lookUp(target, env).catch(() => null),
    ]);
    const type = page.headers.get("content-type") || "";
    if (!tags || page.status !== 200 || !type.includes("text/html")) return page;

    const response = rewrite(page, preview.headEdits(tags));
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};

// GitHub Pages' copy of the page. Conditional headers are dropped when the page is to be rewritten, or a 304
// would leave a browser with its earlier, generic copy. ORIGIN points `wrangler dev` at the live site.
function originRequest(request, url, env, fresh) {
  const address = env.ORIGIN ? new URL(url.pathname + url.search, env.ORIGIN).toString() : request.url;
  const headers = new Headers(request.headers);
  if (fresh) {
    headers.delete("if-none-match");
    headers.delete("if-modified-since");
  }
  return new Request(address, { method: request.method, headers, redirect: "manual" });
}

// The listing's or the store's preview tags, or null. Uses the functions the pages themselves call with the
// publishable key, so nothing new is granted to anyone.
async function lookUp(target, env) {
  if (target.kind === "listing") {
    const bundle = await rpc(env, "browse_listing_page", { p_listing_id: target.id });
    return bundle && preview.listingTags(bundle, target.id, listingRules, env.SUPABASE_URL);
  }
  const page =
    (await rpc(env, "browse_store_page", { p_slug: target.slug, p_with_play_places: true })) ||
    (await rpc(env, "browse_store_page", { p_slug: target.slug }));
  return page && preview.storeTags(page, target.slug, storeRules, env.SUPABASE_URL);
}

async function rpc(env, name, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(env.SUPABASE_URL + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_KEY,
        Authorization: "Bearer " + env.SUPABASE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return response.ok ? await response.json() : null;
  } finally {
    clearTimeout(timer);
  }
}

function rewrite(page, edits) {
  let appended = false;
  let rewriter = new HTMLRewriter()
    .on("title", { element: (element) => element.setInnerContent(edits.title) })
    .on("head", {
      element: (element) =>
        element.onEndTag((end) => {
          if (!appended) end.before(edits.append, { html: true });
          appended = true;
        }),
    });
  for (const edit of edits.set) {
    rewriter = rewriter.on(edit.selector, { element: (element) => element.setAttribute("content", edit.value) });
  }
  for (const selector of edits.remove) {
    rewriter = rewriter.on(selector, { element: (element) => element.remove() });
  }
  const response = rewriter.transform(page);
  // The body is already decoded here. Keeping GitHub's `content-encoding: gzip` made the cached copy come back
  // compressed twice (seen with `wrangler dev`); Cloudflare compresses the answer itself for whoever asks.
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("etag");
  headers.delete("last-modified");
  headers.set("cache-control", "public, max-age=" + CACHE_SECONDS);
  return new Response(response.body, { status: response.status, headers });
}
