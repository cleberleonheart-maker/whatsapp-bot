import test from 'node:test';
import assert from 'node:assert/strict';
import { isNoisySessionLog } from '../src/logger.js';

test('logger filtra logs internos de sessão do libsignal', () => {
  assert.equal(isNoisySessionLog('Closing session:', { currentRatchet: {} }), true);
  assert.equal(isNoisySessionLog('Opening session:', {}), true);
  assert.equal(isNoisySessionLog('Session already closed', {}), true);
  assert.equal(isNoisySessionLog('Session already open'), true);
  assert.equal(isNoisySessionLog('Removing old closed session:', { currentRatchet: {} }), true);
  assert.equal(isNoisySessionLog('Closing open session in favor of incoming prekey bundle'), true);
  assert.equal(isNoisySessionLog('Failed to decrypt message with any known session...'), true);
  assert.equal(isNoisySessionLog('Session error:Error: Bad MAC'), true);
  assert.equal(isNoisySessionLog('[INFO] Comando executado'), false);
  assert.equal(isNoisySessionLog('Mensagem normal'), false);
});
