import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const rules = createRequire(import.meta.url)('../assets/listing-rules.js');

const UUID = '8a7f3b2e-1c4d-4e5f-9a0b-1c2d3e4f5a6b';

test('parseListingId accepts a lowercase uuid', () => assert.equal(rules.parseListingId(`?id=${UUID}`), UUID));
test('parseListingId lowercases an uppercase one', () => assert.equal(rules.parseListingId(`?id=${UUID.toUpperCase()}`), UUID));
test('parseListingId ignores other parameters', () => assert.equal(rules.parseListingId(`?utm=x&id=${UUID}&env=staging`), UUID));
test('parseListingId refuses 32 chars without dashes, empty and missing', () => {
  assert.equal(rules.parseListingId('?id=8a7f3b2e1c4d4e5f9a0b1c2d3e4f5a6b'), null);
  assert.equal(rules.parseListingId('?id='), null);
  assert.equal(rules.parseListingId(''), null);
  assert.equal(rules.parseListingId('?id=zzz'), null);
});
test('oldPathListingId reads /l/<uuid> with or without a trailing slash', () => {
  assert.equal(rules.oldPathListingId(`/l/${UUID}/`), UUID);
  assert.equal(rules.oldPathListingId(`/l/${UUID.toUpperCase()}`), UUID);
  assert.equal(rules.oldPathListingId('/l/'), null);
  assert.equal(rules.oldPathListingId('/privacidad/'), null);
});
test('detectPlatform iPhone', () =>
  assert.equal(rules.detectPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)', maxTouchPoints: 5 }), 'ios'));
test('detectPlatform iPadOS with a Mac user agent', () =>
  assert.equal(rules.detectPlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', maxTouchPoints: 5 }), 'ios'));
test('detectPlatform a real Mac', () =>
  assert.equal(rules.detectPlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 }), 'other'));
test('detectPlatform Android, uaPlatform first', () => {
  assert.equal(rules.detectPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9)', maxTouchPoints: 5 }), 'android');
  assert.equal(rules.detectPlatform({ userAgent: 'x', maxTouchPoints: 0, uaPlatform: 'Android' }), 'android');
  assert.equal(rules.detectPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0)', maxTouchPoints: 0, uaPlatform: 'Windows' }), 'other');
});
test('formatPrice', () => {
  assert.equal(rules.formatPrice('650.00', 'MXN'), '$650');
  assert.equal(rules.formatPrice(1250, 'MXN'), '$1,250');
  assert.equal(rules.formatPrice('99.5', 'MXN'), '$99.50');
  assert.equal(rules.formatPrice(10, 'USD'), '$10 USD');
});
test('relativeDays', () => {
  const now = new Date('2026-11-02T12:00:00Z');
  assert.equal(rules.relativeDays('2026-11-02T08:00:00Z', now), 'hoy');
  assert.equal(rules.relativeDays('2026-11-01T08:00:00Z', now), 'ayer');
  assert.equal(rules.relativeDays('2026-10-25T08:00:00Z', now), 'hace 8 días');
  assert.equal(rules.relativeDays('2026-09-01T08:00:00Z', now), 'hace 2 meses');
  assert.equal(rules.relativeDays('2026-10-03T08:00:00Z', now), 'hace 1 mes');
});
test('photoURL and avatarURL point at the public buckets', () => {
  assert.equal(rules.photoURL('https://x.supabase.co', 'u/l/front.jpg'), 'https://x.supabase.co/storage/v1/object/public/listing-photos/u/l/front.jpg');
  assert.equal(rules.avatarURL('https://x.supabase.co', 'u/avatar.jpg'), 'https://x.supabase.co/storage/v1/object/public/avatars/u/avatar.jpg');
});
test('androidIntentURL carries the id and falls back to the page', () =>
  assert.match(rules.androidIntentURL(`https://meeplo.com.mx/l/?id=${UUID}`),
    new RegExp(`^intent://meeplo\\.com\\.mx/l/\\?id=${UUID}#Intent;scheme=https;package=com\\.meeplo\\.meeploapp;S\\.browser_fallback_url=https%3A%2F%2Fmeeplo\\.com\\.mx%2Fl%2F%3Fid%3D${UUID};end$`)));
test('labels and store URLs', () => {
  assert.equal(rules.labels.condition.like_new, 'Como nuevo');
  assert.equal(rules.labels.condition.sealed, 'Sellado');
  assert.equal(rules.storeURLs.ios, 'https://apps.apple.com/mx/app/meeplo/id6824672527');
  assert.equal(rules.storeURLs.android, 'https://play.google.com/store/apps/details?id=com.meeplo.meeploapp');
});
