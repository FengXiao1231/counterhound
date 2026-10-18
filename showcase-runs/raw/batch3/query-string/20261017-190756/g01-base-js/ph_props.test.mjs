import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {parseUrl, stringifyUrl, parse, stringify, extract, pick} from '../../../../base.js';

const word = fc.stringMatching(/^[a-z0-9]{1,6}$/);
const val = fc.string({maxLength: 8});
const plain = o => ({...o});

test('parse(stringify(obj)) round-trips string values', () => {
	fc.assert(fc.property(fc.dictionary(word, val, {maxKeys: 5}), obj => {
		assert.deepEqual(plain(parse(stringify(obj))), obj);
	}));
});

test('round-trip arrays for each arrayFormat', () => {
	for (const arrayFormat of ['bracket', 'index', 'colon-list-separator', 'none']) {
		fc.assert(fc.property(fc.dictionary(word, fc.array(word, {minLength: 2, maxLength: 4}), {maxKeys: 4}), obj => {
			const out = plain(parse(stringify(obj, {arrayFormat}), {arrayFormat, sort: false}));
			assert.deepEqual(Object.entries(out).sort(), Object.entries(obj).sort());
		}));
	}
});

test('stringifyUrl preserves existing index-format array in url', () => {
	fc.assert(fc.property(fc.array(word, {minLength: 1, maxLength: 3}), arr => {
		const q = arr.map((v, i) => `a[${i}]=${v}`).join('&');
		const url = `http://x.com?${q}`;
		assert.equal(stringifyUrl({url, query: {}}, {arrayFormat: 'index', encode: false}), url);
	}));
});

test('comma round-trip arrays of plain words', () => {
	fc.assert(fc.property(fc.dictionary(word, fc.array(word, {minLength: 2, maxLength: 4}), {maxKeys: 4}), obj => {
		const out = plain(parse(stringify(obj, {arrayFormat: 'comma'}), {arrayFormat: 'comma'}));
		assert.deepEqual(out, obj);
	}));
});

test('extract of url with query returns the query before hash', () => {
	fc.assert(fc.property(word, word, word, (path, q, h) => {
		assert.equal(extract(`http://x/${path}?${q}=1#${h}`), `${q}=1`);
	}));
});

test('parseUrl/stringifyUrl round-trip', () => {
	fc.assert(fc.property(word, fc.dictionary(word, word, {maxKeys: 4}), word, (path, q, h) => {
		const u = {url: `http://x.com/${path}`, query: q, fragmentIdentifier: h};
		const r = parseUrl(stringifyUrl(u), {parseFragmentIdentifier: true});
		assert.equal(r.url, u.url);
		assert.deepEqual(plain(r.query), q);
		assert.equal(r.fragmentIdentifier, h);
	}));
});

test('pick with all keys keeps the query', () => {
	fc.assert(fc.property(word, fc.dictionary(word, word, {minKeys: 1, maxKeys: 4}), (path, q) => {
		const url = stringifyUrl({url: `http://x.com/${path}`, query: q});
		assert.equal(pick(url, () => true), url);
	}));
});
