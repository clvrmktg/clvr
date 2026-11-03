import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHandler } from '../netlify/functions/submission-created.mjs';

const environment = () => ({
  FORM_EMAIL_ENABLED: 'true', FORM_EMAIL_MODE: 'test', FORM_EMAIL_CONTACT_FORM_ID: 'contact-form-123',
  FORM_EMAIL_TEST_TO: 'test-inbox@example.invalid', RESEND_API_KEY: 're_private_fixture',
  RESEND_FROM_EMAIL: 'Clever Marketing <noreply@getclever.marketing>',
  RESEND_TO_EMAIL: 'lets@getclever.marketing', RESEND_REPLY_TO_EMAIL: 'lets@getclever.marketing',
});
const payload = () => ({
  id: 'submission-123', form_id: 'contact-form-123', form_name: 'contact',
  created_at: '2026-11-03T01:00:00Z',
  data: {
    'form-name': 'contact', first_name: 'Sample', last_name: 'Submitter', email: 'customer@example.invalid',
    business: 'Example Business', phone: '+1 242 555 1234', current_website: 'https://example.invalid/',
    help_with: 'Website Design', message: 'Please discuss a new website with our team.', newsletter: 'on',
    site: 'https://getclever.marketing/contact-us/', 'bot-field': '',
  },
});
const event = value => ({ httpMethod: 'POST', isBase64Encoded: false, body: JSON.stringify({ payload: value }) });
const response = (status = 200, body = { id: 'resend-123' }, headers = {}) => new Response(JSON.stringify(body), { status, headers });
function setup({ env = environment(), fetchImpl } = {}) {
  const calls = [], logs = [], sleeps = [];
  const handler = createHandler({
    env, log: value => logs.push(value), sleep: async ms => sleeps.push(ms),
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.resend.com/emails');
      const call = { url, ...options, payload: JSON.parse(options.body) };
      calls.push(call);
      return fetchImpl ? fetchImpl(call) : response();
    },
  });
  return { handler, calls, logs, sleeps };
}

test('valid event sends two independent escaped messages to the staging inbox', async () => {
  const t = setup(); const result = await t.handler(event(payload()));
  assert.equal(result.statusCode, 200); assert.equal(t.calls.length, 2);
  const [internal, confirmation] = t.calls.map(x => x.payload);
  for (const mail of [internal, confirmation]) {
    assert.deepEqual(mail.to, ['test-inbox@example.invalid']);
    assert.equal(mail.from, 'Clever Marketing <noreply@getclever.marketing>');
    assert.match(mail.subject, /^\[TEST\]/);
  }
  assert.ok(!Object.hasOwn(internal, 'reply_to'));
  assert.equal(confirmation.reply_to, 'lets@getclever.marketing');
  for (const text of ['Sample Submitter', 'Example Business', '+1 242 555 1234', 'customer@example.invalid',
    'https://example.invalid/', 'Website Design', 'Please discuss', 'submission-123', 'Newsletter requested: Yes']) {
    assert.ok(internal.text.includes(text), text);
  }
  assert.ok(!confirmation.text.includes(payload().data.message));
  assert.match(confirmation.text, /within one business day/);
  assert.notEqual(t.calls[0].headers['Idempotency-Key'], t.calls[1].headers['Idempotency-Key']);
  assert.equal(t.calls[0].redirect, 'error');
});

test('delivery defaults off and does not require credentials or parse a body', async () => {
  const t = setup({ env: {} });
  assert.equal(JSON.parse((await t.handler(null)).body).status, 'disabled');
  assert.equal(t.calls.length, 0);
});

test('test mode is the default and cannot be overridden by submitted fields', async () => {
  const env = environment(); delete env.FORM_EMAIL_MODE;
  const t = setup({ env }); const p = payload();
  Object.assign(p.data, { to: 'attacker@example.invalid', FORM_EMAIL_MODE: 'live', id: 'forged-id', reply_to: 'attacker@example.invalid' });
  await t.handler(event(p));
  assert.ok(t.calls.every(x => x.payload.to[0] === env.FORM_EMAIL_TEST_TO));
  assert.ok(t.calls.every(x => x.headers['Idempotency-Key'].includes('/submission-123/')));
});

test('live mode requires explicit production/main runtime identity', async () => {
  for (const extra of [{}, { CONTEXT: 'production', BRANCH: 'main' }, { FORM_EMAIL_DEPLOY_CONTEXT: 'deploy-preview', FORM_EMAIL_DEPLOY_BRANCH: 'main' }, { FORM_EMAIL_DEPLOY_CONTEXT: 'production', FORM_EMAIL_DEPLOY_BRANCH: 'staging' }]) {
    const t = setup({ env: { ...environment(), FORM_EMAIL_MODE: 'live', ...extra } });
    assert.equal((await t.handler(event(payload()))).statusCode, 503); assert.equal(t.calls.length, 0);
  }
  const t = setup({ env: { ...environment(), FORM_EMAIL_MODE: 'live', FORM_EMAIL_DEPLOY_CONTEXT: 'production', FORM_EMAIL_DEPLOY_BRANCH: 'main' } });
  await t.handler(event(payload()));
  assert.deepEqual(t.calls.map(x => x.payload.to), [['lets@getclever.marketing'], ['customer@example.invalid']]);
});

test('configuration fails closed without a form ID, key, valid addresses, or test inbox', async () => {
  for (const [key, value] of [['FORM_EMAIL_CONTACT_FORM_ID', ''], ['RESEND_API_KEY', ''], ['FORM_EMAIL_TEST_TO', ''],
    ['RESEND_FROM_EMAIL', 'sender@example.invalid'], ['RESEND_TO_EMAIL', 'x@example.invalid\r\nBcc: bad@example.invalid'],
    ['RESEND_REPLY_TO_EMAIL', 'not-an-email'], ['FORM_EMAIL_MODE', 'typo']]) {
    const t = setup({ env: { ...environment(), [key]: value } });
    assert.equal((await t.handler(event(payload()))).statusCode, 503, key); assert.equal(t.calls.length, 0);
    assert.deepEqual(t.logs, [{ event: 'form_email', outcome: 'configuration_error' }]);
  }
});

test('wrong form, explicit spam and honeypot events cannot send', async () => {
  const cases = [
    p => { p.form_name = 'wizard'; }, p => { p.form_id = 'other-form'; },
    p => { p.spam = true; }, p => { p.state = 'spam'; }, p => { p.data['bot-field'] = 'bot'; },
  ];
  for (const change of cases) {
    const t = setup(), p = payload(); change(p);
    assert.equal(JSON.parse((await t.handler(event(p))).body).status, 'ignored'); assert.equal(t.calls.length, 0);
  }
});

test('missing submission metadata, malformed input and browser-shaped requests cannot send', async () => {
  const cases = [
    p => { delete p.id; }, p => { p.id = 'bad/id'; }, p => { p.created_at = 'yesterday'; },
    p => { p.data['form-name'] = 'wizard'; }, p => { p.data.email = 'x@example.invalid\nBcc: y@example.invalid'; },
    p => { p.data.first_name = ['duplicate', 'fields']; }, p => { p.data.help_with = 'Injected service'; },
    p => { p.data.message = '\u0000bad message'; }, p => { p.data.message = 'x'.repeat(2001); },
    p => { p.data.current_website = 'javascript:alert(1)'; }, p => { p.data = null; },
    p => { p.data.site = 'https://user:password@example.invalid/'; }, p => { p.data.newsletter = 'unexpected'; },
  ];
  for (const change of cases) {
    const t = setup(), p = payload(); change(p);
    assert.equal((await t.handler(event(p))).statusCode, 400); assert.equal(t.calls.length, 0);
  }
  for (const input of [null, { ...event(payload()), httpMethod: 'GET' }, { ...event(payload()), isBase64Encoded: true },
    { httpMethod: 'POST', body: 'form-name=contact&g-recaptcha-response=fake' },
    { httpMethod: 'POST', body: '{broken-json' }, { httpMethod: 'POST', body: ' '.repeat(32769) }]) {
    const t = setup(); assert.equal((await t.handler(input)).statusCode, 400); assert.equal(t.calls.length, 0);
  }
});

test('HTML is escaped while plain enquiry text is preserved; secrets and content never logged', async () => {
  const p = payload(); p.data.first_name = '<img src=x onerror=alert(1)>'; p.data.message = '<script>malicious()</script> & "quoted" text';
  const t = setup(); await t.handler(event(p));
  for (const { payload: mail } of t.calls) {
    assert.ok(!mail.html.includes('<img')); assert.ok(!mail.html.includes('<script>'));
    assert.ok(mail.html.includes('&lt;img'));
  }
  assert.ok(t.calls[0].payload.text.includes(p.data.message));
  const logs = JSON.stringify(t.logs);
  for (const secret of [environment().RESEND_API_KEY, p.data.email, p.data.message, p.data.first_name]) assert.ok(!logs.includes(secret));
});

test('duplicate invocation reuses provider idempotency keys and produces only two provider sends', async () => {
  const sent = new Map(); let deliveries = 0;
  const t = setup({ fetchImpl: call => {
    const key = call.headers['Idempotency-Key'];
    if (sent.has(key)) { assert.equal(sent.get(key).body, call.body); return response(200, { id: sent.get(key).id }); }
    const id = `resend-${++deliveries}`; sent.set(key, { id, body: call.body }); return response(200, { id });
  } });
  await t.handler(event(payload())); await t.handler(event(payload()));
  assert.equal(deliveries, 2); assert.equal(t.calls.length, 4); assert.equal(sent.size, 2);
});

test('failure of either email does not prevent the other; permanent errors are not retried', async () => {
  for (const failedPurpose of ['notification', 'confirmation']) {
    const t = setup({ fetchImpl: call => call.headers['Idempotency-Key'].endsWith(failedPurpose)
      ? response(422, { message: 'PRIVATE PAYLOAD ERROR', name: 'validation_error' }) : response() });
    assert.equal((await t.handler(event(payload()))).statusCode, 502); assert.equal(t.calls.length, 2);
    assert.equal(t.logs.filter(x => x.outcome === 'accepted').length, 1);
    assert.ok(!JSON.stringify(t.logs).includes('PRIVATE PAYLOAD ERROR'));
  }
});

test('rate limits, concurrent idempotency and server failures retry with the identical request', async () => {
  for (const status of [429, 503, 409]) {
    const seen = new Map();
    const t = setup({ fetchImpl: call => {
      const key = call.headers['Idempotency-Key']; const old = seen.get(key); seen.set(key, call.body);
      if (!old) return response(status, { name: 'concurrent_idempotent_requests' }, { 'Retry-After': '0.5' });
      assert.equal(old, call.body); return response();
    } });
    assert.equal((await t.handler(event(payload()))).statusCode, 200);
    assert.equal(t.calls.length, 4); assert.deepEqual(t.sleeps, [500, 500]);
  }
});

test('partial failure can be retried without duplicating a successful notification', async () => {
  let failConfirmation = true; const sent = new Map(); let deliveries = 0;
  const t = setup({ fetchImpl: call => {
    const key = call.headers['Idempotency-Key'];
    if (key.endsWith('/confirmation') && failConfirmation) return response(503, {});
    if (!sent.has(key)) sent.set(key, `resend-${++deliveries}`);
    return response(200, { id: sent.get(key) });
  } });
  assert.equal((await t.handler(event(payload()))).statusCode, 502);
  failConfirmation = false; assert.equal((await t.handler(event(payload()))).statusCode, 200);
  assert.equal(deliveries, 2);
});

test('network failures are bounded; long Retry-After is respected without retrying early', async () => {
  const t = setup({ fetchImpl: () => { throw new Error('PRIVATE NETWORK ERROR'); } });
  assert.equal((await t.handler(event(payload()))).statusCode, 502); assert.equal(t.calls.length, 6);
  assert.ok(t.logs.every(x => x.attempts === 3)); assert.ok(!JSON.stringify(t.logs).includes('PRIVATE NETWORK ERROR'));
  const long = setup({ fetchImpl: () => response(429, {}, { 'Retry-After': '120' }) });
  assert.equal((await long.handler(event(payload()))).statusCode, 502); assert.equal(long.calls.length, 2); assert.equal(long.sleeps.length, 0);
});

test('idempotency payload conflicts fail without changing the key', async () => {
  const t = setup({ fetchImpl: () => response(409, { name: 'invalid_idempotent_request' }) });
  assert.equal((await t.handler(event(payload()))).statusCode, 502); assert.equal(t.calls.length, 2);
});

test('browser retains native Netlify submission and no client Resend hook', async () => {
  const form = await readFile(new URL('../layouts/partials/forms/contact.html', import.meta.url), 'utf8');
  const base = await readFile(new URL('../layouts/_default/baseof.html', import.meta.url), 'utf8');
  const validate = await readFile(new URL('../assets/scripts/components/validate.js', import.meta.url), 'utf8');
  assert.match(form, /action="\/thank-you\/" method="POST"/);
  assert.match(form, /name="form-name" value="contact"/);
  assert.match(form, /data-netlify-recaptcha="true"/);
  assert.ok(!base.includes('components/resend.js')); assert.ok(!validate.includes('fetch('));
  assert.match(validate, /HTMLFormElement\.prototype\.submit\.call\(form\)/);
});

test('real request timeout bounds a stalled provider without leaking errors', { timeout: 10000 }, async () => {
  const t = setup({ fetchImpl: call => new Promise((resolve, reject) => {
    const keepAlive = setTimeout(() => reject(new Error('mock provider failed to abort')), 4000);
    call.signal.addEventListener('abort', () => {
      clearTimeout(keepAlive); reject(new DOMException('Private timeout detail', 'AbortError'));
    }, { once: true });
  }) });
  assert.equal((await t.handler(event(payload()))).statusCode, 502);
  assert.equal(t.calls.length, 6);
  assert.ok(t.logs.every(x => x.attempts === 3 && x.reason === 'network_failure'));
  assert.ok(!JSON.stringify(t.logs).includes('Private timeout detail'));
});

test('ambiguous provider success without a message ID retries with the original keys', async () => {
  const t = setup({ fetchImpl: () => response(200, {}) });
  assert.equal((await t.handler(event(payload()))).statusCode, 502);
  assert.equal(t.calls.length, 6);
  assert.equal(new Set(t.calls.map(x => x.headers['Idempotency-Key'])).size, 2);
});
