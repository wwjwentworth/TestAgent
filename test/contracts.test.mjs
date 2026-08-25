import assert from 'node:assert/strict';
import test from 'node:test';
import { EVENT_TYPES, isRecordedEvent } from '../backend/packages/event-schema/src/index.mjs';
import { MockModelProvider } from '../Agent/llm-gateway/src/index.mjs';
import { PlaywrightGenerator } from '../Agent/playwright-generator/src/index.mjs';

test('event schema exposes the initial domain contract', () => {
  assert.ok(EVENT_TYPES.includes('click'));
  assert.equal(isRecordedEvent({ timestamp: Date.now(), source: 'action', type: 'click', data: {} }), true);
  assert.equal(isRecordedEvent({ type: 'unknown' }), false);
});

test('mock model keeps the skeleton runnable without credentials', async () => {
  const result = await new MockModelProvider().generateStructured();
  assert.deepEqual(result, { provider: 'mock', output: null });
});

test('playwright generator creates readable actions with stable locators', () => {
  const source = new PlaywrightGenerator().generate({ pageUrl: 'https://example.test' }, [{ timestamp: 1, source: 'action', type: 'input', data: { target: { testId: 'email' }, value: 'qa@example.test' } }]);
  assert.match(source, /page\.goto/);
  assert.match(source, /getByTestId\("email"\)\.fill\("qa@example\.test"\)/);
});
