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
