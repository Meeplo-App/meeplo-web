import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const preview = require('../worker/preview.js');
const listingRules = require('../assets/listing-rules.js');
const storeRules = require('../assets/store-rules.js');

const API = 'https://szulqqeyuxjqpynvggvy.supabase.co';
const UUID = '0b6f3c1e-5d2a-4f7b-9c8e-1a2b3c4d5e6f';

const bundle = {
  listing: { title: 'Catan', condition: 'good', price_amount: 650, price_currency: 'MXN', description: 'Completo, con las dos expansiones.' },
  seller: { username: 'pepe_corona', avatar_path: 'u/avatar.jpg' },
  photos: [
    { card_path: 'u/l/front-card.jpg', storage_path: 'u/l/front.jpg' },
    { card_path: 'u/l/back-card.jpg', storage_path: 'u/l/back.jpg' },
  ],
  places: [{ name: 'Parque Hundido', kind: 'park' }],
};

const route = (path, search) => preview.route(path, search, listingRules, storeRules);

test('route reads the two pages and leaves every other path alone', () => {
  assert.deepEqual(route('/l/', `?id=${UUID}`), { kind: 'listing', id: UUID });
  assert.deepEqual(route('/l/', `?id=${UUID.toUpperCase()}&utm_source=x`), { kind: 'listing', id: UUID });
  assert.deepEqual(route('/t/', '?s=Dados-Meeples'), { kind: 'store', slug: 'dados-meeples' });
  assert.equal(route('/l/', ''), null);
  assert.equal(route('/l/', '?id=not-a-uuid'), null);
  assert.equal(route('/t/', '?s=x'), null);
  assert.equal(route('/l/listing.css', ''), null);
  assert.equal(route('/privacidad/', ''), null);
});

test('route sends the link forms 404.html handles where 404.html sends a browser', () => {
  assert.deepEqual(route(`/l/${UUID}`, ''), { kind: 'redirect', location: `/l/?id=${UUID}` });
  assert.deepEqual(route('/t/dados-meeples', ''), { kind: 'redirect', location: '/t/?s=dados-meeples' });
  assert.deepEqual(route('/t/dados-meeples/', '?utm_source=qr'), { kind: 'redirect', location: '/t/?s=dados-meeples&utm_source=qr' });
});

test('a listing previews its first photo, its title and price, as Google reads them', () => {
  const tags = preview.listingTags(bundle, UUID, listingRules, API);
  assert.equal(tags.title, 'Catan usado · $650 · Meeplo');
  assert.equal(tags.description, listingRules.searchDescription(bundle.listing));
  assert.equal(tags.url, `https://meeplo.com.mx/l/?id=${UUID}`);
  assert.equal(tags.image, `${API}/storage/v1/object/public/listing-photos/u/l/front-card.jpg`);
  assert.equal(tags.imageType, 'image/jpeg');
  assert.equal(tags.large, true);
});

test('a listing preview never names the seller or their places', () => {
  const text = JSON.stringify(preview.headEdits(preview.listingTags(bundle, UUID, listingRules, API)));
  assert.ok(!text.includes('pepe_corona'));
  assert.ok(!text.includes('avatar'));
  assert.ok(!text.includes('Parque Hundido'));
});

test('a listing without photos keeps the mascot; no listing gives no preview', () => {
  const tags = preview.listingTags({ ...bundle, photos: [] }, UUID, listingRules, API);
  assert.equal(tags.image, preview.MASCOT);
  assert.equal(tags.large, false);
  assert.equal(preview.listingTags({}, UUID, listingRules, API), null);
  assert.equal(preview.listingTags(null, UUID, listingRules, API), null);
});

test('a store previews its cover, else its logo, else the mascot', () => {
  const store = { name: 'Turno Extra', city: 'CDMX', venue_kind: 'play_space', cover_photo_path: 's/cover.jpg', logo_path: 's/logo.jpg' };
  const withCover = preview.storeTags({ store, play: null }, 'turno-extra', storeRules, API);
  assert.equal(withCover.title, storeRules.searchTitle(store));
  assert.equal(withCover.url, 'https://meeplo.com.mx/t/?s=turno-extra');
  assert.equal(withCover.image, `${API}/storage/v1/object/public/store-photos/s/cover.jpg`);
  assert.equal(withCover.large, true);
  const withLogo = preview.storeTags({ store: { ...store, cover_photo_path: null } }, 'turno-extra', storeRules, API);
  assert.equal(withLogo.image, `${API}/storage/v1/object/public/store-photos/s/logo.jpg`);
  assert.equal(withLogo.large, false);
  const bare = preview.storeTags({ store: { name: 'Turno Extra' } }, 'turno-extra', storeRules, API);
  assert.equal(bare.image, preview.MASCOT);
  assert.equal(preview.storeTags({}, 'turno-extra', storeRules, API), null);
});

test('headEdits changes every preview tag and drops the mascot size only when a photo replaces it', () => {
  const edits = preview.headEdits(preview.listingTags(bundle, UUID, listingRules, API));
  const selectors = edits.set.map((edit) => edit.selector);
  for (const name of ['og:title', 'og:description', 'og:image', 'og:image:type', 'og:image:alt']) {
    assert.ok(selectors.includes(`meta[property="${name}"]`), name);
  }
  for (const name of ['description', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt']) {
    assert.ok(selectors.includes(`meta[name="${name}"]`), name);
  }
  assert.equal(edits.set.find((edit) => edit.selector === 'meta[name="twitter:card"]').value, 'summary_large_image');
  assert.deepEqual(edits.remove, ['meta[property="og:image:width"]', 'meta[property="og:image:height"]']);
  assert.match(edits.append, /<link rel="canonical" href="https:\/\/meeplo\.com\.mx\/l\/\?id=/);
  const mascot = preview.headEdits(preview.listingTags({ ...bundle, photos: [] }, UUID, listingRules, API));
  assert.deepEqual(mascot.remove, []);
});

test('appended tags escape what they carry', () => {
  assert.equal(preview.escapeAttribute('a"b<c>&d'), 'a&quot;b&lt;c&gt;&amp;d');
});
