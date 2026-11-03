// Netlify's reserved event-function name authenticates invocations before this
// Lambda-compatible handler runs. Do not add a public path or browser caller.
const API_URL = 'https://api.resend.com/emails';
const SERVICES = new Set(['Website Design', 'Website Maintenance', 'Local SEO', "I'm Not Sure"]);
const IDENTIFIER = /^[A-Za-z0-9_-]{1,64}$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 2000;

class InvalidInput extends Error {}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function field(value, max, { required = false, multiline = false, min = 1 } = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' || value.length > max || CONTROL.test(value)
      || (!multiline && /[\r\n]/.test(value))) throw new InvalidInput();
  const result = value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (required && result.length < min) throw new InvalidInput();
  return result;
}

function mailbox(value) {
  const result = field(value, 254, { required: true });
  // A single mailbox only: no display names, lists, whitespace, or headers.
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(result)
      || result.includes('..')) throw new InvalidInput();
  const [local, domain] = result.split('@');
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.')
      || domain.split('.').some(label => !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))) throw new InvalidInput();
  return result;
}

function url(value) {
  const result = field(value, 2048);
  if (!result) return '';
  try {
    const parsed = new URL(result);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new InvalidInput();
  } catch { throw new InvalidInput(); }
  return result;
}

function submission(event, formId) {
  if (event?.httpMethod !== 'POST' || typeof event.body !== 'string'
      || event.isBase64Encoded || Buffer.byteLength(event.body) > 32768) throw new InvalidInput();
  let payload;
  try { ({ payload } = JSON.parse(event.body)); } catch { throw new InvalidInput(); }
  if (!record(payload) || !record(payload.data)) throw new InvalidInput();
  // Use trusted metadata, never data.id or the browser's hidden form-name alone.
  if (payload.form_name !== 'contact' || payload.form_id !== formId) return null;
  if (payload.spam === true || payload.state === 'spam' || payload.data['bot-field']) return null;
  if (payload.spam !== undefined && typeof payload.spam !== 'boolean') throw new InvalidInput();
  if (typeof payload.id !== 'string' || !IDENTIFIER.test(payload.id)) throw new InvalidInput();
  if (typeof payload.created_at !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(payload.created_at)
      || !Number.isFinite(Date.parse(payload.created_at))) throw new InvalidInput();
  const data = payload.data;
  if (data['form-name'] !== undefined && data['form-name'] !== 'contact') throw new InvalidInput();
  const service = field(data.help_with, 80, { required: true });
  if (!SERVICES.has(service)) throw new InvalidInput();
  const newsletter = field(data.newsletter, 10);
  if (!['', 'on', 'true', 'false', '1', '0', 'yes', 'no'].includes(newsletter)) throw new InvalidInput();
  return {
    id: payload.id,
    received: new Date(payload.created_at).toISOString(),
    firstName: field(data.first_name, 100, { required: true, min: 2 }),
    lastName: field(data.last_name, 100),
    email: mailbox(data.email),
    business: field(data.business, 200),
    phone: field(data.phone, 32),
    website: url(data.current_website),
    source: url(data.site),
    service,
    message: field(data.message, 2000, { required: true, multiline: true, min: 10 }),
    newsletter: ['on', 'true', '1', 'yes'].includes(newsletter),
  };
}

function configuration(env) {
  if (!IDENTIFIER.test(env.FORM_EMAIL_CONTACT_FORM_ID || '')) throw new InvalidInput();
  const mode = env.FORM_EMAIL_MODE || 'test';
  if (!['test', 'live'].includes(mode)) throw new InvalidInput();
  // Use Functions-scoped, context-specific settings; CONTEXT/BRANCH are build-only.
  // Missing runtime deployment identity fails closed; never enable live on staging.
  if (mode === 'live' && (env.FORM_EMAIL_DEPLOY_CONTEXT !== 'production' || env.FORM_EMAIL_DEPLOY_BRANCH !== 'main')) throw new InvalidInput();
  const sender = field(env.RESEND_FROM_EMAIL, 320, { required: true });
  const match = sender.match(/^(?:[^<>]{1,80}\s+)?<([^<>]+)>$/);
  const senderAddress = mailbox(match ? match[1] : sender);
  if (!senderAddress.endsWith('@getclever.marketing')) throw new InvalidInput();
  const key = field(env.RESEND_API_KEY, 512, { required: true });
  return {
    formId: env.FORM_EMAIL_CONTACT_FORM_ID,
    mode, key, sender,
    internalTo: mailbox(env.RESEND_TO_EMAIL),
    replyTo: mailbox(env.RESEND_REPLY_TO_EMAIL),
    testTo: mode === 'test' ? mailbox(env.FORM_EMAIL_TEST_TO) : null,
  };
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function messages(item, config) {
  const name = [item.firstName, item.lastName].filter(Boolean).join(' ');
  const internal = [
    'A new contact enquiry has been recorded in Netlify Forms.', '',
    `Name: ${name}`, `Email: ${item.email}`,
    `Business: ${item.business || 'Not provided'}`, `Phone: ${item.phone || 'Not provided'}`,
    `Current website: ${item.website || 'Not provided'}`, `Service of interest: ${item.service}`, '',
    'Message:', item.message, '',
    `Newsletter requested: ${item.newsletter ? 'Yes' : 'No'}`,
    `Submission reference: ${item.id}`, `Received: ${item.received}`,
    `Submitted page: ${item.source || 'Not provided'}`,
  ].join('\n');
  const confirmation = [
    `Hi ${item.firstName},`, '',
    'Thanks for contacting Clever Marketing. We’ve received your enquiry and will get back to you within one business day.', '',
    'If you’d like to add anything, simply reply to this email.', '',
    'Best,', 'Clever Marketing', 'https://getclever.marketing',
  ].join('\n');
  const test = config.mode === 'test';
  const make = (purpose, to, subject, text, replyTo) => {
    if (test) text += '\n\nTEST MODE — delivery redirected to the configured test inbox.';
    const payload = {
      from: config.sender, to: [test ? config.testTo : to],
      subject: `${test ? '[TEST] ' : ''}${subject}`, text,
      html: `<div style="white-space:pre-wrap">${escapeHTML(text)}</div>`,
    };
    if (replyTo) payload.reply_to = replyTo;
    return { purpose, payload, key: `contact/${config.formId}/${item.id}/${purpose}` };
  };
  return [
    make('notification', config.internalTo, `New website enquiry — ${item.service}`, internal),
    make('confirmation', item.email, 'We’ve received your enquiry — Clever Marketing', confirmation, config.replyTo),
  ];
}

function retryDelay(response, attempt) {
  const value = response?.headers?.get('retry-after');
  if (value) {
    const delay = /^\d+(?:\.\d+)?$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now();
    if (Number.isFinite(delay)) return Math.max(0, Math.ceil(delay));
  }
  return attempt * 250;
}

async function send(message, config, fetchImpl, sleep) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response;
    let code;
    try {
      response = await fetchImpl(API_URL, {
        method: 'POST', redirect: 'error',
        headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', 'Idempotency-Key': message.key },
        body: JSON.stringify(message.payload), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      let result;
      try { result = await response.json(); } catch { /* Retry ambiguous results using the same key. */ }
      if (response.ok && typeof result?.id === 'string' && IDENTIFIER.test(result.id)) {
        return { outcome: 'accepted', resendId: result.id, attempts: attempt };
      }
      const concurrent = response.status === 409 && result?.name === 'concurrent_idempotent_requests';
      const transient = response.ok || concurrent || [408, 425, 429].includes(response.status) || response.status >= 500;
      if (!transient) return { outcome: 'failed', reason: 'provider_rejected', httpStatus: response.status, attempts: attempt };
      code = 'transient_failure';
    } catch { code = 'network_failure'; }
    const delay = retryDelay(response, attempt);
    // Respect long Retry-After values by deferring recovery, not retrying early.
    if (attempt === MAX_ATTEMPTS || delay > 1000) {
      return { outcome: 'failed', reason: code, httpStatus: response?.status, attempts: attempt };
    }
    await sleep(delay);
  }
}

const reply = (statusCode, status) => ({ statusCode, body: JSON.stringify({ status }) });

export function createHandler({
  env = process.env, fetchImpl = globalThis.fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  log = entry => console.info(JSON.stringify(entry)),
} = {}) {
  return async event => {
    if (env.FORM_EMAIL_ENABLED !== 'true') return reply(200, 'disabled');
    let config;
    try { config = configuration(env); }
    catch { log({ event: 'form_email', outcome: 'configuration_error' }); return reply(503, 'configuration_error'); }
    let item;
    try { item = submission(event, config.formId); }
    catch { log({ event: 'form_email', outcome: 'invalid_event' }); return reply(400, 'invalid_event'); }
    if (!item) return reply(200, 'ignored');
    const requests = messages(item, config);
    // Both messages are attempted even when either one fails.
    const outcomes = await Promise.allSettled(requests.map(message => send(message, config, fetchImpl, sleep)));
    let failed = false;
    outcomes.forEach((result, index) => {
      const outcome = result.status === 'fulfilled' ? result.value : { outcome: 'failed', reason: 'delivery_error' };
      if (outcome.outcome !== 'accepted') failed = true;
      log({ event: 'form_email', submissionId: item.id, purpose: requests[index].purpose, mode: config.mode, ...outcome });
    });
    // This event response does not change the already-recorded Netlify submission.
    return reply(failed ? 502 : 200, failed ? 'delivery_incomplete' : 'accepted');
  };
}

export const handler = createHandler();
