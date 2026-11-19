import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const rules = createRequire(import.meta.url)('../assets/store-rules.js');

test('parseSlug reads s and normalises it', () => {
  assert.equal(rules.parseSlug('?s=dados-meeples-cafe'), 'dados-meeples-cafe');
  assert.equal(rules.parseSlug('?utm_source=x&s=DADOS&env=staging'), 'dados');
  assert.equal(rules.parseSlug('?s=%20dados%20'), 'dados');
});
test('parseSlug refuses what the database would never write', () => {
  assert.equal(rules.parseSlug(''), null);
  assert.equal(rules.parseSlug('?s='), null);
  assert.equal(rules.parseSlug('?s=da'), null);
  assert.equal(rules.parseSlug('?s=' + 'a'.repeat(41)), null);
  assert.equal(rules.parseSlug('?s=da--dos'), null);
  assert.equal(rules.parseSlug('?s=-dados'), null);
  assert.equal(rules.parseSlug('?s=dad%C3%B3s'), null);
  assert.equal(rules.parseSlug('?s=dados.html'), null);
  assert.equal(rules.parseSlug('?s=%E0%A4%A'), null);
});
test('pathSlug reads /t/<slug> with or without a trailing slash', () => {
  assert.equal(rules.pathSlug('/t/dados-meeples-cafe'), 'dados-meeples-cafe');
  assert.equal(rules.pathSlug('/t/Dados/'), 'dados');
  assert.equal(rules.pathSlug('/t/'), null);
  assert.equal(rules.pathSlug('/t/dados/extra'), null);
  assert.equal(rules.pathSlug('/l/dados'), null);
  assert.equal(rules.pathSlug('/privacidad/'), null);
});
test('pathRedirect sends a store link to the page, keeping other parameters', () => {
  assert.equal(rules.pathRedirect('/t/Dados', ''), '/t/?s=dados');
  assert.equal(rules.pathRedirect('/t/dados/', '?env=staging'), '/t/?s=dados&env=staging');
  assert.equal(rules.pathRedirect('/t/da', ''), null);
  assert.equal(rules.pathRedirect('/l/8a7f3b2e-1c4d-4e5f-9a0b-1c2d3e4f5a6b', ''), null);
});
test('shareURL is the link the apps share', () =>
  assert.equal(rules.shareURL('dados'), 'https://meeplo.com.mx/t/dados'));
test('storePhotoURL points at the public bucket', () =>
  assert.equal(rules.storePhotoURL('https://x.supabase.co/', 'u/logo-1.jpg'),
    'https://x.supabase.co/storage/v1/object/public/store-photos/u/logo-1.jpg'));

const week = [{ day: 1, opens: '10:00', closes: '20:00' }, { day: 6, opens: '12:00', closes: '24:00' }];
// 2026-11-16 is a Monday; Mexico City is UTC-6.
test('openStatus follows the store\'s time zone, as the apps do', () => {
  assert.deepEqual(rules.openStatus(week, 'America/Mexico_City', new Date('2026-11-16T15:00:00Z')), { kind: 'opensLater', opens: '10:00' });
  assert.deepEqual(rules.openStatus(week, 'America/Mexico_City', new Date('2026-11-16T16:00:00Z')), { kind: 'open', closes: '20:00' });
  assert.deepEqual(rules.openStatus(week, 'America/Mexico_City', new Date('2026-11-17T02:30:00Z')), { kind: 'closedNow' });
  assert.deepEqual(rules.openStatus(week, 'America/Mexico_City', new Date('2026-11-17T18:00:00Z')), { kind: 'closedToday' });
  assert.deepEqual(rules.openStatus(week, 'America/Mexico_City', new Date('2026-11-22T05:30:00Z')), { kind: 'open', closes: '24:00' });
  assert.deepEqual(rules.openStatus([], 'America/Mexico_City', new Date('2026-11-16T16:00:00Z')), { kind: 'closedToday' });
});
test('openStatusText is the apps\' wording', () => {
  assert.equal(rules.openStatusText({ kind: 'open', closes: '20:00' }), 'Abierto ahora · cierra 20:00');
  assert.equal(rules.openStatusText({ kind: 'opensLater', opens: '10:00' }), 'Cerrado · abre 10:00');
  assert.equal(rules.openStatusText({ kind: 'closedNow' }), 'Cerrado hoy');
  assert.equal(rules.openStatusText({ kind: 'closedToday' }), 'Cerrado hoy');
});
test('weekRows lists the seven days, Monday first', () => {
  const rows = rules.weekRows(week);
  assert.equal(rows.length, 7);
  assert.deepEqual(rows[0], { name: 'Lunes', text: '10:00 – 20:00' });
  assert.deepEqual(rows[1], { name: 'Martes', text: 'Cerrado' });
  assert.deepEqual(rows[5], { name: 'Sábado', text: '12:00 – 24:00' });
  assert.equal(rows[6].name, 'Domingo');
});
test('eventDate is in Spanish, in the store\'s time zone', () =>
  assert.equal(rules.eventDate('2026-11-22T00:00:00Z', 'America/Mexico_City'), 'Sábado 21 de noviembre · 18:00'));
test('placesLeftText', () => {
  assert.equal(rules.placesLeftText(null), null);
  assert.equal(rules.placesLeftText(0), 'lleno');
  assert.equal(rules.placesLeftText(1), 'queda 1 lugar');
  assert.equal(rules.placesLeftText(4), 'quedan 4 lugares');
});
test('countLabel', () => {
  assert.equal(rules.countLabel(14, 'el juego', 'juegos'), 'Ver los 14 juegos en la app');
  assert.equal(rules.countLabel(1, 'el juego', 'juegos'), 'Ver el juego en la app');
});
test('mapsURL searches by name and address, never a position', () => {
  assert.equal(rules.mapsURL('ios', 'Dados', 'Av. Juárez 10'), 'https://maps.apple.com/?q=Dados%2C%20Av.%20Ju%C3%A1rez%2010');
  assert.equal(rules.mapsURL('android', 'Dados', 'Av. Juárez 10'),
    'https://www.google.com/maps/search/?api=1&query=Dados%2C%20Av.%20Ju%C3%A1rez%2010');
  assert.equal(rules.mapsURL('other', 'Dados', null), 'https://www.google.com/maps/search/?api=1&query=Dados');
});
test('instagramURL', () => assert.equal(rules.instagramURL('dados.mx'), 'https://www.instagram.com/dados.mx/'));
test('androidIntentURL carries the slug and falls back to the page', () =>
  assert.equal(rules.androidIntentURL('dados', 'https://meeplo.com.mx/t/?s=dados'),
    'intent://meeplo.com.mx/t/dados#Intent;scheme=https;package=com.meeplo.meeploapp;S.browser_fallback_url=https%3A%2F%2Fmeeplo.com.mx%2Ft%2F%3Fs%3Ddados;end'));
test('appSchemeURL', () => assert.equal(rules.appSchemeURL('dados'), 'com.meeplo.meeploapp://store/dados'));
test('brandColor is a Pro store\'s own, else Meeplo\'s purple', () => {
  assert.equal(rules.brandColor({ is_pro: true, brand_color: '#112233' }), '#112233');
  assert.equal(rules.brandColor({ is_pro: false, brand_color: '#112233' }), '#4a44c6');
  assert.equal(rules.brandColor({ is_pro: true, brand_color: null }), '#4a44c6');
  assert.equal(rules.brandColor({ is_pro: true, brand_color: 'red' }), '#4a44c6');
});

test('a game space says its kind; a shop, none and an unknown kind say nothing', () => {
  assert.equal(rules.venueKindLabel({ venue_kind: 'play_space' }), 'Espacio de juegos');
  assert.equal(rules.venueKindLabel({ venue_kind: 'shop' }), null);
  assert.equal(rules.venueKindLabel({}), null);
  assert.equal(rules.venueKindLabel({ venue_kind: 'bar' }), null);
  assert.equal(rules.venueKindLabel({ venue_kind: 'toString' }), null);
});
test('the check mark is labelled by kind', () => {
  assert.equal(rules.verifiedLabel({ venue_kind: 'play_space' }), 'Espacio verificado');
  assert.equal(rules.verifiedLabel({ venue_kind: 'shop' }), 'Tienda verificada');
  assert.equal(rules.verifiedLabel({}), 'Tienda verificada');
  assert.equal(rules.verifiedLabel({ venue_kind: 'bar' }), 'Tienda verificada');
});
test('a place sells games unless the server says it does not', () => {
  assert.equal(rules.sellsGames({ sells_games: false }), false);
  assert.equal(rules.sellsGames({ sells_games: true }), true);
  assert.equal(rules.sellsGames({}), true);
  assert.equal(rules.sellsGames({ sells_games: null }), true);
});
test('placeFacts: a shop where nobody plays (or a backend before 073) shows none', () => {
  assert.deepEqual(rules.placeFacts({}, undefined), []);
  assert.deepEqual(rules.placeFacts({ venue_kind: 'shop', sells_games: true }, null), []);
});
test('placeFacts: in the apps\' order, each only when true', () => {
  const play = { fee_note: null, house_rules: null, serves_food: true };
  assert.deepEqual(rules.placeFacts({ venue_kind: 'shop', sells_games: true }, play),
    ['Se juega aquí', 'Vende juegos', 'Comida y bebida']);
  assert.deepEqual(rules.placeFacts({ venue_kind: 'shop', sells_games: true }, { serves_food: false }),
    ['Se juega aquí', 'Vende juegos']);
  assert.deepEqual(rules.placeFacts({ venue_kind: 'play_space', sells_games: true }, play),
    ['Se juega aquí', 'Vende juegos', 'Comida y bebida']);
  assert.deepEqual(rules.placeFacts({ venue_kind: 'play_space', sells_games: false }, play),
    ['Se juega aquí', 'Comida y bebida']);
  assert.deepEqual(rules.placeFacts({ venue_kind: 'play_space', sells_games: false }, { serves_food: false }),
    ['Se juega aquí']);
});
test('placeFacts: without play, no «Se juega aquí» and no food', () => {
  assert.deepEqual(rules.placeFacts({ venue_kind: 'play_space', sells_games: true }, null), ['Vende juegos']);
});
test('playFacts is null without play, and keeps only what the place wrote', () => {
  assert.equal(rules.playFacts(null), null);
  assert.equal(rules.playFacts(undefined), null);
  assert.deepEqual(rules.playFacts({ fee_note: ' Cover $80 ', house_rules: '  ', library: [], library_count: 0 }),
    { fee: 'Cover $80', rules: null, games: [], count: 0 });
});
test('playFacts lists the library games with their notes and counts them all', () => {
  const facts = rules.playFacts({
    fee_note: null, house_rules: 'Sin alcohol', serves_food: false,
    library: [{ name: 'Azul', note: 'Dos copias' }, { name: 'Catan', note: null }, { name: ' ' }, null],
    library_count: 16,
  });
  assert.deepEqual(facts.games, [{ name: 'Azul', note: 'Dos copias' }, { name: 'Catan', note: null }]);
  assert.equal(facts.count, 16);
  assert.equal(rules.playFacts({ library: [{ name: 'Azul' }] }).count, 1);
});
test('every event names the business as its organiser', () => {
  assert.equal(rules.organiserLine('Dados y Meeples'), 'Para mayores de 18 años · Organiza: Dados y Meeples');
});

// ---- P150 on the web and P154 (migration 082) --------------------------------------------------------------

const PLACE = {
  slug: 'dados-y-meeples', name: 'Dados y Meeples', city: 'CDMX', address: 'Av. Juárez 10, Centro', is_online: false,
  venue_kind: 'play_space', sells_games: true, description: 'Café con más de 300 juegos.',
  hours: [{ day: 1, opens: '10:00', closes: '20:00' }, { day: 6, opens: '12:00', closes: '24:00' }],
  website: 'https://dados.example', instagram: 'dadosmeeples', maps_url: null,
};
const PLAY = {
  serves_food: true, menu_url: 'https://dados.example/menu',
  gallery: [{ path: 'u/gallery-2.jpg', kind: 'events' }, { path: 'u/gallery-1.jpg', kind: 'place' }, { path: '', kind: 'place' }],
};

test('galleryPhotos keeps each photo with a path; an unknown label reads «El lugar»', () => {
  assert.deepEqual(rules.galleryPhotos(PLAY), [{ path: 'u/gallery-2.jpg', kind: 'events' }, { path: 'u/gallery-1.jpg', kind: 'place' }]);
  assert.deepEqual(rules.galleryPhotos({ gallery: [{ path: 'x.jpg', kind: 'other' }] }), [{ path: 'x.jpg', kind: 'place' }]);
  assert.deepEqual(rules.galleryPhotos(null), []);
});
test('galleryChips: «Todas» and each label with a photo, in the apps\' order; none for one label', () => {
  assert.deepEqual(rules.galleryChips(rules.galleryPhotos(PLAY)).map((c) => c.label), ['Todas', 'El lugar', 'Eventos']);
  assert.deepEqual(rules.galleryChips([{ path: 'a', kind: 'activities' }]), []);
  assert.equal(rules.galleryLabel('activities'), 'Actividades');
});
test('menuURL only for an https link', () => {
  assert.equal(rules.menuURL(PLAY), 'https://dados.example/menu');
  assert.equal(rules.menuURL({ menu_url: 'http://x.example' }), null);
  assert.equal(rules.menuURL(null), null);
});
test('reviewsURL: the place\'s own Google Maps link, else the maps search; none online', () => {
  assert.equal(rules.reviewsURL('android', { ...PLACE, maps_url: 'https://maps.app.goo.gl/Abc' }), 'https://maps.app.goo.gl/Abc');
  assert.equal(rules.reviewsURL('ios', { ...PLACE, maps_url: 'https://evil.example/maps' }),
    'https://maps.apple.com/?q=' + encodeURIComponent('Dados y Meeples, Av. Juárez 10, Centro'));
  assert.equal(rules.reviewsURL('other', { ...PLACE, is_online: true, address: null }), null);
});
test('the search result: title and description by kind and city, at most 160 characters', () => {
  assert.equal(rules.searchTitle(PLACE), 'Dados y Meeples · Espacio de juegos en CDMX · Meeplo');
  assert.equal(rules.searchTitle({ ...PLACE, venue_kind: 'shop' }), 'Dados y Meeples · Tienda de juegos de mesa en CDMX · Meeplo');
  assert.equal(rules.searchTitle({ ...PLACE, venue_kind: 'shop', is_online: true }), 'Dados y Meeples · Tienda de juegos de mesa en línea · Meeplo');
  assert.equal(rules.searchDescription(PLACE, PLAY),
    'Espacio de juegos en CDMX: se juega aquí, vende juegos, comida y bebida. Café con más de 300 juegos.');
  assert.equal(rules.searchDescription({ ...PLACE, venue_kind: 'shop', description: null }, null),
    'Tienda de juegos de mesa en CDMX. Horario, eventos y juegos en Meeplo.');
  assert.ok(rules.searchDescription({ ...PLACE, description: 'palabra '.repeat(40) }, PLAY).length <= 160);
});
test('canonicalURL is the query form, which GitHub Pages serves with 200', () => {
  assert.equal(rules.canonicalURL('dados-y-meeples'), 'https://meeplo.com.mx/t/?s=dados-y-meeples');
});
test('structuredData: a game space with its address, hours, links and menu, never its WhatsApp or position', () => {
  const data = rules.structuredData({ ...PLACE, whatsapp: '+525512345678' }, PLAY, 'dados-y-meeples', ['https://x/p.jpg'], 'https://x/l.jpg');
  assert.equal(data['@type'], 'EntertainmentBusiness');
  assert.equal(data.url, 'https://meeplo.com.mx/t/?s=dados-y-meeples');
  assert.deepEqual(data.address, { '@type': 'PostalAddress', streetAddress: 'Av. Juárez 10, Centro', addressCountry: 'MX', addressLocality: 'CDMX' });
  assert.deepEqual(data.openingHoursSpecification.map((h) => [h.dayOfWeek, h.opens, h.closes]),
    [['https://schema.org/Monday', '10:00', '20:00'], ['https://schema.org/Saturday', '12:00', '23:59']]);
  assert.deepEqual(data.sameAs, ['https://dados.example', 'https://www.instagram.com/dadosmeeples/']);
  assert.equal(data.hasMenu, 'https://dados.example/menu');
  assert.ok(data.hasMap.startsWith('https://www.google.com/maps/search/'));
  assert.ok(!/telephone|whatsapp|5512345678|geo|latitude/i.test(JSON.stringify(data)));
});
test('structuredData: a shop is a Store; an online one an OnlineStore with no address or hours', () => {
  assert.equal(rules.structuredData({ ...PLACE, venue_kind: 'shop' }, null, 's', [], null)['@type'], 'Store');
  const online = rules.structuredData({ ...PLACE, venue_kind: 'shop', is_online: true, address: null }, null, 's', [], null);
  assert.equal(online['@type'], 'OnlineStore');
  assert.equal(online.address, undefined);
  assert.equal(online.openingHoursSpecification, undefined);
  assert.equal(online.hasMap, undefined);
});
