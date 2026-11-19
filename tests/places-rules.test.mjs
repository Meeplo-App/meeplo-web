import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const rules = createRequire(import.meta.url)('../assets/places-rules.js');

const SPACE = {
  slug: 'dados-y-meeples', name: 'Dados y Meeples', city: 'CDMX', is_online: false, venue_kind: 'play_space',
  offers_play: true, sells_games: true, serves_food: true, logo_path: 'u/logo.jpg', photo_path: 'u/inside.jpg',
  brand_color: null,
};
const SHOP = { ...SPACE, slug: 'juegos-olga', name: 'Juegos Olga', venue_kind: 'shop', offers_play: false, serves_food: false };
const ONLINE = { ...SHOP, slug: 'zeta', name: 'Zeta', is_online: true, city: 'Mérida', photo_path: null };

test('parseSearch defaults to every place, page 1', () => {
  assert.deepEqual(rules.parseSearch(''), { query: '', tipo: null, page: 1 });
  assert.deepEqual(rules.parseSearch('?utm_source=x'), { query: '', tipo: null, page: 1 });
});
test('parseSearch reads tipo (tiendas, espacios) and ignores anything else', () => {
  assert.equal(rules.parseSearch('?tipo=espacios').tipo, 'espacios');
  assert.equal(rules.parseSearch('?tipo=tiendas').tipo, 'tiendas');
  assert.equal(rules.parseSearch('?tipo=online').tipo, null);
});
test('parseSearch trims the query, caps it, and reads pagina from 1 to MAX_PAGE', () => {
  assert.equal(rules.parseSearch('?q=%20%20ciudad%20%20de%20m%C3%A9xico%20').query, 'ciudad de méxico');
  assert.equal(rules.parseSearch('?q=' + 'a'.repeat(200)).query.length, 80);
  assert.equal(rules.parseSearch('?pagina=3').page, 3);
  assert.equal(rules.parseSearch('?pagina=0').page, 1);
  assert.equal(rules.parseSearch('?pagina=9999').page, rules.MAX_PAGE);
});
test('rpcArguments sends the kind as the database names it', () => {
  assert.deepEqual(rules.rpcArguments({ query: '', tipo: null, page: 1 }), { p_query: null, p_kind: null, p_limit: 24, p_offset: 0 });
  assert.deepEqual(rules.rpcArguments({ query: 'cdmx', tipo: 'espacios', page: 2 }),
    { p_query: 'cdmx', p_kind: 'play_space', p_limit: 24, p_offset: 24 });
  assert.equal(rules.rpcArguments({ query: '', tipo: 'tiendas', page: 1 }).p_kind, 'shop');
});
test('pageHref keeps the search and the kind', () => {
  assert.equal(rules.pageHref('', null, 1), './');
  assert.equal(rules.pageHref('cdmx', 'espacios', 2), './?q=cdmx&tipo=espacios&pagina=2');
});
test('chips: Todos, Tiendas, Espacios de juegos, the current one marked, back to page 1', () => {
  const chips = rules.chips({ query: 'cdmx', tipo: 'espacios', page: 3 });
  assert.deepEqual(chips.map((c) => c.label), ['Todos', 'Tiendas', 'Espacios de juegos']);
  assert.deepEqual(chips.map((c) => c.current), [false, false, true]);
  assert.deepEqual(chips.map((c) => c.href), ['./?q=cdmx', './?q=cdmx&tipo=tiendas', './?q=cdmx&tipo=espacios']);
});
test('a search is noindex and points to its kind; the pages and the kinds are their own', () => {
  assert.equal(rules.robotsContent({ query: 'cdmx', tipo: null, page: 1 }), 'noindex, follow');
  assert.equal(rules.robotsContent({ query: '', tipo: 'espacios', page: 2 }), null);
  assert.equal(rules.canonicalURL({ query: '', tipo: null, page: 1 }), 'https://meeplo.com.mx/lugares/');
  assert.equal(rules.canonicalURL({ query: '', tipo: 'espacios', page: 2 }), 'https://meeplo.com.mx/lugares/?tipo=espacios&pagina=2');
  assert.equal(rules.canonicalURL({ query: 'cdmx', tipo: 'tiendas', page: 3 }), 'https://meeplo.com.mx/lugares/?tipo=tiendas');
});
test('documentTitle and heading by kind', () => {
  assert.equal(rules.documentTitle({ query: '', tipo: null, page: 1 }),
    'Tiendas de juegos de mesa y espacios para jugar en México · Meeplo');
  assert.equal(rules.documentTitle({ query: '', tipo: 'espacios', page: 2 }),
    'Espacios de juegos de mesa: dónde jugar en México · página 2 · Meeplo');
  assert.equal(rules.documentTitle({ query: 'cdmx', tipo: null, page: 1 }), '«cdmx»: tiendas y espacios de juegos · Meeplo');
  assert.equal(rules.heading({ tipo: 'tiendas' }), 'Tiendas de juegos de mesa');
});
test('summaryText counts places', () => {
  assert.equal(rules.summaryText({ query: '', page: 1 }, 1), '1 lugar');
  assert.equal(rules.summaryText({ query: 'cdmx', page: 1 }, 3), '3 lugares para «cdmx»');
  assert.equal(rules.summaryText({ query: '', page: 2 }, 60), 'Página 2 de 3 · 60 lugares');
});
test('cardLine: the kind and the city, or «Tienda en línea»', () => {
  assert.equal(rules.cardLine(SPACE), 'Espacio de juegos · CDMX');
  assert.equal(rules.cardLine(SHOP), 'Tienda · CDMX');
  assert.equal(rules.cardLine(ONLINE), 'Tienda en línea');
});
test('cardFacts as the place page says them: none for a shop where nobody plays', () => {
  assert.deepEqual(rules.cardFacts(SPACE), ['Se juega aquí', 'Vende juegos', 'Comida y bebida']);
  assert.deepEqual(rules.cardFacts(SHOP), []);
  assert.deepEqual(rules.cardFacts({ ...SHOP, offers_play: true }), ['Se juega aquí', 'Vende juegos']);
  assert.deepEqual(rules.cardFacts({ ...SPACE, sells_games: false, serves_food: false }), ['Se juega aquí']);
});
test('a card links to the place page by its query form, and shows its photo, else its logo', () => {
  assert.equal(rules.placeURL(SPACE), 'https://meeplo.com.mx/t/?s=dados-y-meeples');
  assert.equal(rules.imagePath(SPACE), 'u/inside.jpg');
  assert.equal(rules.imagePath(ONLINE), 'u/logo.jpg');
  assert.equal(rules.imagePath({ ...ONLINE, logo_path: null }), null);
  assert.equal(rules.initial({ name: '  zeta ' }), 'Z');
});
test('structuredData is an ItemList of the page, in order, with positions across pages', () => {
  const data = rules.structuredData({ query: '', tipo: null, page: 2 }, [SPACE, SHOP]);
  assert.equal(data['@type'], 'ItemList');
  assert.equal(data.numberOfItems, 2);
  assert.deepEqual(data.itemListElement.map((e) => e.position), [25, 26]);
  assert.equal(data.itemListElement[0].url, 'https://meeplo.com.mx/t/?s=dados-y-meeples');
  assert.ok(!JSON.stringify(data).includes('address'));
});
