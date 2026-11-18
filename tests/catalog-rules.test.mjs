import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const rules = createRequire(import.meta.url)('../assets/catalog-rules.js');

const ITEM = {
  id: '8a7f3b2e-1c4d-4e5f-9a0b-1c2d3e4f5a6b', title: 'Catan', condition: 'good', category: 'family',
  is_expansion: false, price_amount: 650, price_currency: 'MXN', card_path: 'u/l/front-card.jpg',
};

test('parseSearch defaults to the whole catalog, page 1', () => {
  assert.deepEqual(rules.parseSearch(''), { query: '', page: 1 });
  assert.deepEqual(rules.parseSearch('?utm_source=x'), { query: '', page: 1 });
});
test('parseSearch trims and collapses the query, and caps it at 80 characters', () => {
  assert.equal(rules.parseSearch('?q=%20%20catan%20%20%20junior%20').query, 'catan junior');
  assert.equal(rules.parseSearch('?q=' + 'a'.repeat(200)).query.length, 80);
});
test('parseSearch reads pagina as a whole number from 1 to MAX_PAGE', () => {
  assert.equal(rules.parseSearch('?pagina=3').page, 3);
  assert.equal(rules.parseSearch('?pagina=0').page, 1);
  assert.equal(rules.parseSearch('?pagina=-2').page, 1);
  assert.equal(rules.parseSearch('?pagina=2.5').page, 1);
  assert.equal(rules.parseSearch('?pagina=abc').page, 1);
  assert.equal(rules.parseSearch('?pagina=9999').page, rules.MAX_PAGE);
});
test('rpcArguments pages by PAGE_SIZE and sends no query when there is none', () => {
  assert.deepEqual(rules.rpcArguments({ query: '', page: 1 }), { p_query: null, p_limit: 24, p_offset: 0 });
  assert.deepEqual(rules.rpcArguments({ query: 'catan', page: 3 }), { p_query: 'catan', p_limit: 24, p_offset: 48 });
});
test('pageCount is at least 1 and rounds up', () => {
  assert.equal(rules.pageCount(0), 1);
  assert.equal(rules.pageCount(24), 1);
  assert.equal(rules.pageCount(25), 2);
  assert.equal(rules.pageCount(190), 8);
});
test('pageHref keeps the query and leaves page 1 out', () => {
  assert.equal(rules.pageHref('', 1), './');
  assert.equal(rules.pageHref('', 2), './?pagina=2');
  assert.equal(rules.pageHref('catán', 1), './?q=cat%C3%A1n');
  assert.equal(rules.pageHref('catan', 2), './?q=catan&pagina=2');
});
test('canonicalURL: catalog pages are their own, a search points to the catalog', () => {
  assert.equal(rules.canonicalURL({ query: '', page: 1 }), 'https://meeplo.com.mx/buscar/');
  assert.equal(rules.canonicalURL({ query: '', page: 3 }), 'https://meeplo.com.mx/buscar/?pagina=3');
  assert.equal(rules.canonicalURL({ query: 'catan', page: 2 }), 'https://meeplo.com.mx/buscar/');
});
test('robotsContent: only a search is noindex, and its links are still followed', () => {
  assert.equal(rules.robotsContent({ query: '', page: 4 }), null);
  assert.equal(rules.robotsContent({ query: 'catan', page: 1 }), 'noindex, follow');
});
test('documentTitle', () => {
  assert.equal(rules.documentTitle({ query: '', page: 1 }), 'Juegos de mesa usados en venta en México · Meeplo');
  assert.equal(rules.documentTitle({ query: '', page: 2 }), 'Juegos de mesa usados en venta en México · página 2 · Meeplo');
  assert.equal(rules.documentTitle({ query: 'Catan', page: 1 }), '«Catan»: juegos de mesa usados · Meeplo');
});
test('countText and summaryText', () => {
  assert.equal(rules.countText(1), '1 juego');
  assert.equal(rules.countText(1250), '1,250 juegos');
  assert.equal(rules.summaryText({ query: '', page: 1 }, 20), '20 juegos en venta');
  assert.equal(rules.summaryText({ query: 'catan', page: 1 }, 3), '3 juegos para «catan»');
  assert.equal(rules.summaryText({ query: '', page: 2 }, 190), 'Página 2 de 8 · 190 juegos en venta');
});
test('cardDetails uses the app\'s labels and marks an expansion', () => {
  assert.equal(rules.cardDetails(ITEM), 'Buen estado · Familiar');
  assert.equal(rules.cardDetails({ ...ITEM, condition: 'sealed', category: 'strategy', is_expansion: true }),
    'Sellado · Estrategia · Expansión');
  assert.equal(rules.cardDetails({ ...ITEM, condition: 'unknown', category: null }), '');
});
test('cardPrice, listingURL and imageAlt', () => {
  assert.equal(rules.cardPrice(ITEM), '$650');
  assert.equal(rules.cardPrice({ ...ITEM, price_amount: '1250.00' }), '$1,250');
  assert.equal(rules.listingURL(ITEM), 'https://meeplo.com.mx/l/?id=' + ITEM.id);
  assert.equal(rules.imageAlt(ITEM), 'Catan, usado');
  assert.equal(rules.imageAlt({ ...ITEM, condition: 'sealed' }), 'Catan, sellado');
});
test('structuredData is an ItemList numbered across pages, with no seller', () => {
  const data = rules.structuredData({ query: '', page: 2 }, [ITEM]);
  assert.equal(data['@type'], 'ItemList');
  assert.equal(data.url, 'https://meeplo.com.mx/buscar/?pagina=2');
  assert.deepEqual(data.itemListElement, [
    { '@type': 'ListItem', position: 25, url: 'https://meeplo.com.mx/l/?id=' + ITEM.id, name: 'Catan' },
  ]);
  assert.doesNotMatch(JSON.stringify(data), /seller|username/);
});
