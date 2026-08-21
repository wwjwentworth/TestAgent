import assert from 'node:assert/strict';
import test from 'node:test';
import { EVENT_TYPES, isRecordedEvent } from '../backend/packages/event-schema/src/index.mjs';
import { MockModelProvider } from '../Agent/llm-gateway/src/index.mjs';

test('event schema exposes the initial domain contract', () => {
  assert.ok(EVENT_TYPES.includes('click'));
  assert.equal(isRecordedEvent({ timestamp: Date.now(), source: 'action', type: 'click', data: {} }), true);
  assert.equal(isRecordedEvent({ type: 'unknown' }), false);
});

test('mock model keeps the skeleton runnable without credentials', async () => {
  const result = await new MockModelProvider().generateStructured();
  assert.deepEqual(result, { provider: 'mock', output: null });
});
