import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCityQuery, pickPlace } from '../src/commands/utilidades.js';

const results = [
  { name: 'Alvorada', admin1: 'Rio Grande do Sul', country: 'Brasil' },
  { name: 'Alvorada', admin1: 'Tocantins', country: 'Brasil' }
];

test('clima: interpreta cidade com UF', () => {
  assert.deepEqual(parseCityQuery('alvorada RS'), { name: 'alvorada', state: 'RS' });
  assert.deepEqual(parseCityQuery('Alvorada, RS'), { name: 'Alvorada', state: 'RS' });
  assert.deepEqual(parseCityQuery('Alvorada-RS'), { name: 'Alvorada', state: 'RS' });
});

test('clima: ignora UF inválida e mantém texto original', () => {
  assert.deepEqual(parseCityQuery('Alvorada XX'), { name: 'Alvorada XX', state: '' });
  assert.deepEqual(parseCityQuery('São Paulo'), { name: 'São Paulo', state: '' });
});

test('clima: escolhe resultado do estado informado', () => {
  assert.equal(pickPlace(results, 'RS').admin1, 'Rio Grande do Sul');
  assert.equal(pickPlace(results, 'TO').admin1, 'Tocantins');
  assert.equal(pickPlace(results, '').name, 'Alvorada');
  assert.equal(pickPlace(results, 'SC'), null);
});
