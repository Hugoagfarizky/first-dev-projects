import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compactJson,
  compactJsonText,
  formatJson,
  formatJsonText,
  parseJson,
} from '../js/json-formatter.js';

test('parseJson mem-parse object, array, string, number, boolean, dan null', () => {
  assert.deepEqual(parseJson('{"a":1,"b":[true,null,"x"]}').value, { a: 1, b: [true, null, 'x'] });
  assert.equal(parseJson('42').value, 42);
  assert.equal(parseJson('"text"').value, 'text');
});

test('parseJson menolak JSON invalid dan input kosong', () => {
  assert.equal(parseJson('').ok, false);
  assert.equal(parseJson('{bad').ok, false);
  assert.equal(parseJson('   ').ok, false);
});

test('parseJson menolak input bukan string', () => {
  assert.equal(parseJson(123).ok, false);
  assert.equal(parseJson(null).ok, false);
});

test('formatJson menghasilkan JSON valid dengan indentasi konsisten', () => {
  const formatted = formatJson({ a: 1, b: [2, 3] }, 2);
  assert.match(formatted, /\n  "a": 1/);
  assert.deepEqual(JSON.parse(formatted), { a: 1, b: [2, 3] });
});

test('formatJsonText memformat JSON valid dan menolak invalid', () => {
  const result = formatJsonText('{"a":1}', 2);
  assert.equal(result.ok, true);
  assert.match(result.formatted, /"a": 1/);

  const invalid = formatJsonText('{bad', 2);
  assert.equal(invalid.ok, false);
});

test('compactJson dan compactJsonText menghasilkan JSON valid', () => {
  assert.equal(compactJson({ a: 1, b: [2, 3] }), '{"a":1,"b":[2,3]}');
  const result = compactJsonText('{"a": 1}');
  assert.equal(result.ok, true);
  assert.equal(result.compact, '{"a":1}');
});

test('formatJson tidak memutasi input', () => {
  const input = { a: { b: 2 } };
  const copy = JSON.parse(JSON.stringify(input));
  formatJson(input, 2);
  assert.deepEqual(input, copy);
});

test('formatJson menangani nested structure', () => {
  const value = { users: [{ id: 1, name: 'dev' }, { id: 2, name: 'ops' }] };
  const formatted = formatJson(value, 2);
  assert.deepEqual(JSON.parse(formatted), value);
});