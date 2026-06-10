import { expect, test } from '@rstest/core';
import { createHono } from '../src/core/hono';
import type { DBAdapter, Options } from '../src/core/type';

type RequestAPNs = NonNullable<Options['requestAPNs']>;
type PushPayload = { aps: { alert: { body?: string } } };

const createTestDb = (): DBAdapter => ({
  countAll: async () => 1,
  deviceTokenByKey: async (key) =>
    key === 'device-key' ? 'device-token' : undefined,
  saveDeviceTokenByKey: async () => {},
  deleteDeviceByKey: async () => {},
  saveAuthorizationToken: async () => {},
  getAuthorizationToken: async () => 'cached-token',
});

const createTestApp = (
  requestAPNs: RequestAPNs = async () => ({ status: 200, message: 'ok' }),
) =>
  createHono({
    db: createTestDb(),
    allowNewDevice: true,
    allowQueryNums: true,
    maxBatchPushCount: Number.NaN,
    urlPrefix: '/bark',
    requestAPNs,
  });

test('returns ok for trailing device key health probes without push parameters', async () => {
  let pushCount = 0;
  const app = createTestApp(async () => {
    pushCount += 1;
    return { status: 200, message: 'ok' };
  });

  const response = await app.fetch(
    new Request('https://example.com/bark/device-key/'),
  );

  expect(response.status).toBe(200);
  expect(await response.text()).toBe('ok');
  expect(pushCount).toBe(0);
});

test('returns ok for trailing device key POST health probes without a body', async () => {
  let pushCount = 0;
  const app = createTestApp(async () => {
    pushCount += 1;
    return { status: 200, message: 'ok' };
  });

  const response = await app.fetch(
    new Request('https://example.com/bark/device-key/', { method: 'POST' }),
  );

  expect(response.status).toBe(200);
  expect(await response.text()).toBe('ok');
  expect(pushCount).toBe(0);
});

test('returns ok for trailing device key HEAD health probes', async () => {
  let pushCount = 0;
  const app = createTestApp(async () => {
    pushCount += 1;
    return { status: 200, message: 'ok' };
  });

  const response = await app.fetch(
    new Request('https://example.com/bark/device-key/', { method: 'HEAD' }),
  );

  expect(response.status).toBe(200);
  expect(await response.text()).toBe('');
  expect(pushCount).toBe(0);
});

test('keeps trailing device key requests with push query parameters as pushes', async () => {
  const requests: PushPayload[] = [];
  const app = createTestApp(async (_deviceToken, _headers, aps) => {
    requests.push(aps as PushPayload);
    return { status: 200, message: 'ok' };
  });

  const response = await app.fetch(
    new Request('https://example.com/bark/device-key/?body=hello'),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    code: 200,
    message: 'success',
  });
  expect(requests).toHaveLength(1);
  expect(requests[0].aps.alert.body).toBe('hello');
});

test('keeps trailing device key requests with body parameters as pushes', async () => {
  const requests: PushPayload[] = [];
  const app = createTestApp(async (_deviceToken, _headers, aps) => {
    requests.push(aps as PushPayload);
    return { status: 200, message: 'ok' };
  });

  const response = await app.fetch(
    new Request('https://example.com/bark/device-key/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'hello from body' }),
    }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    code: 200,
    message: 'success',
  });
  expect(requests).toHaveLength(1);
  expect(requests[0].aps.alert.body).toBe('hello from body');
});

test('keeps non-trailing device key requests as pushes', async () => {
  let pushCount = 0;
  const app = createTestApp(async () => {
    pushCount += 1;
    return { status: 200, message: 'ok' };
  });

  const response = await app.fetch(
    new Request('https://example.com/bark/device-key'),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    code: 200,
    message: 'success',
  });
  expect(pushCount).toBe(1);
});
