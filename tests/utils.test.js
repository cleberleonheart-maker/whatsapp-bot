import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { safeMath, generatePassword, formatMs, normalize, shuffle } from '../src/utils.js';
import { commands, findCommand } from '../src/commands/index.js';

test('safeMath respeita precedência e parênteses', () => {
  assert.equal(safeMath('2+2*3'), 8);
  assert.equal(safeMath('(2+3)*4'), 20);
  assert.equal(safeMath('100/4/5'), 5);
  assert.equal(safeMath('2^3^2'), 512);
});

test('safeMath lida com sinal negativo, funções e multiplicação implícita', () => {
  assert.equal(safeMath('-3+5'), 2);
  assert.equal(safeMath('2^-2'), 0.25);
  assert.equal(safeMath('sqrt(16)+abs(-3)'), 7);
  assert.equal(safeMath('2(3+4)'), 14);
  assert.equal(safeMath('pi'), Math.PI);
});

test('safeMath rejeita expressões inválidas', () => {
  assert.throws(() => safeMath('1/0'));
  assert.throws(() => safeMath('(2+3'));
  assert.throws(() => safeMath('2++'));
});

test('generatePassword respeita o tamanho e o conjunto de caracteres', () => {
  const password = generatePassword(20);
  assert.equal(password.length, 20);
  assert.match(password, /[A-Za-z]/);
  const allowed = /^[A-Za-z0-9!@#$%&*()\-_=+\[\]{}?]+$/;
  assert.match(password, allowed);
});

test('utilitários de texto', () => {
  assert.equal(normalize('Ação'), 'acao');
  assert.equal(formatMs(3661000), '1h 1m 1s');
  assert.equal(shuffle([1, 2, 3]).length, 3);
});

test('registro de comandos não tem duplicatas e tem ajuda', () => {
  const names = commands.map((command) => command.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(findCommand('ajuda'));
  assert.ok(findCommand('piada'));
  assert.ok(findCommand('ppt'));
  assert.ok(commands.every((command) => command.description && command.category));
});

test('arquivos de conteúdo são válidos', () => {
  const base = path.resolve(process.cwd(), 'data');
  const jokes = JSON.parse(fs.readFileSync(path.join(base, 'jokes.json'), 'utf8'));
  const content = JSON.parse(fs.readFileSync(path.join(base, 'content.json'), 'utf8'));
  const quiz = JSON.parse(fs.readFileSync(path.join(base, 'quiz.json'), 'utf8'));
  assert.ok(Object.values(jokes).flat().length > 50);
  assert.ok(content.facts.length > 20);
  assert.ok(content.quotes.length > 20);
  assert.ok(quiz.questions.every((item) => item.options.length >= 2 && item.answer <= item.options.length));
});
