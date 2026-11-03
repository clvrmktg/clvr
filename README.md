# Clever Marketing, Ltd.

**Smart, Stress-Free Web Design in The Bahamas**

Clever Marketing, Ltd. (“Clever”) is a digital marketing and web design company based in Nassau, Bahamas.  
We help small and medium-sized businesses stand out online with websites and digital solutions that are fast, secure, and built to grow with them.

---

## 🚀 Our Mission
We believe every business deserves a strong online presence.  
Our mission is to make web design simple, affordable, and effective for Bahamian businesses—without the stress.

---

## 💻 Services
- **Web Design & Development** – Fast, responsive, and secure websites tailored to your business.  
- **SEO Optimization** – Improve your visibility and rank higher in search results.  
- **Digital Marketing** – Strategies to reach more customers and grow your brand.  
- **Website Maintenance** – Ongoing updates, backups, and monitoring for peace of mind.  

---

## 📂 Repository Purpose
This repository contains assets, documentation, and code related to Clever’s projects, including:
- Website builds (Hugo, Laravel, Kirby, etc.)
- Reusable components and templates
- Documentation for internal workflows
- Marketing and brand guidelines

---

## 🛠️ Tech Stack
Clever primarily works with:
- **Frontend:** HTML5, CSS3, TailwindCSS, Alpine.js  
- **Static Sites:** Hugo, Decap CMS  
- **Web Apps:** Laravel, Livewire, Volt  
- **Hosting & Infra:** Netlify, RunCloud, VULTR  
- **Analytics & SEO:** Google Analytics (proxy-based GA4), JSON-LD structured data  

---

## 📞 Contact
**Clever Marketing, Ltd.**  
Nassau, Bahamas  

- 🌐 Website: [getclever.marketing](https://getclever.marketing)  
- 📧 Email: [lets@getclever.marketing](mailto:lets@getclever.marketing)  
- 📱 Phone: (242) 376-3340  
- 📍 Hours: Monday – Friday, 9:00 am – 5:00 pm (EST)  

Follow us on [Facebook](https://facebook.com/clvrmktg), [Instagram](https://instagram.com/clvrmktg), and [LinkedIn](https://linkedin.com/company/clvrmktg).  

---

## 📜 License
This repository and its contents are © 2025 Clever Marketing, Ltd.  
All rights reserved. Unauthorized use, reproduction, or distribution is prohibited.  

---

## Google reviews

Production builds fetch Google reviews using Places API (New). Set the secret
build environment variable `HUGO_GOOGLE_PLACES_API_KEY` in Netlify to a key from
a project with billing and Places API (New) enabled. Restrict the key to that
API; website referrer restrictions cannot be used for build requests.
The business Place ID is configured in `hugo.toml` under `params.google`.

After changing the key, trigger a production deploy with the build cache cleared.
Reviews and the trust badge share one request per build. Local `hugo server`
previews do not fetch or display reviews. Fetch failures produce a build warning.


## Weekly production rebuild

The `weekly-production-rebuild.yml` GitHub Actions workflow triggers a Netlify
build of `main` every Monday at 09:17 UTC. It also supports manual runs on main.
It does not deploy staging. Scheduled runs become available once the workflow is
merged into main, the repository's default branch.

Create a Netlify build hook for main and store its URL in the GitHub repository
secret `NETLIFY_BUILD_HOOK_URL`. Use the plain hook URL without query parameters.
The workflow clears the build cache so build-time data such as Google reviews
can refresh. A successful workflow means Netlify accepted the request; check
Netlify for the build and deployment result.

Production builds with `GA_TRACKING_ID` fetch Google's tag once per build using
Hugo `resources.GetRemote`, then copy and fingerprint the unchanged script into
`scripts/analytics/gtag.<content-hash>.js`. The existing delayed loader uses that
static URL with an integrity hash. Unchanged contents retain the same URL; vendor
updates produce a new URL. These assets use a one-year immutable cache.

The remote fetch uses a build-specific cache key so a rebuild checks Google even
when Hugo's remote-resource cache persists. Fetch failures fail the build rather
than publish a site with a missing analytics asset. Builds without
`GA_TRACKING_ID` do not fetch or include GA. The old Netlify function remains for
compatibility with older pages; new builds no longer call it.


## Environment configuration

`.env.example` lists current and planned integration settings. `.env` is the
private local copy: Git ignores it, and it must never be placed in `static/`,
`assets/`, or generated public output. Public analytics IDs are prefilled from
the deployed homepage. API keys remain blank unless already supplied by the
local process environment. Never put API keys in Hugo page parameters.

| Variable | Use / deployment scope |
| --- | --- |
| `GA_TRACKING_ID` | Existing GA measurement ID; Netlify build scope; also used by the legacy proxy function |
| `META_PIXEL_ID` | Existing Meta Pixel ID; Netlify build scope; also used by the legacy proxy function |
| `HUGO_GOOGLE_PLACES_API_KEY` | Secret Google Places key; Netlify build scope |
| `RESEND_API_KEY` | Secret Resend credential; Netlify Functions scope |
| `RESEND_FROM_EMAIL` | Approved sender: `noreply@getclever.marketing`; Functions scope |
| `RESEND_REPLY_TO_EMAIL` | Approved reply-to: `lets@getclever.marketing`; Functions scope |
| `RESEND_TO_EMAIL` | Proposed recipient inbox; Functions scope |

The sender and reply-to addresses are approved. Confirm the proposed notification
recipient before enabling delivery.
Resend domain verification alone does not create an API key or implement email
sending. Native Netlify Forms remains the submission and storage path. A server-side
Resend event handler is implemented locally but delivery is disabled by default. Add future variable names and non-secret placeholders to `.env.example`.

Hugo does not automatically load `.env`. Netlify CLI loads it for local
Netlify development; direct Hugo commands require the needed variables exported
in the shell. Keep ordinary local previews in development mode. Configure
hosted variables separately in Netlify, using context-specific values for
staging/deploy previews and production. A local `.env` does not configure the
hosted site. Keep preview email destinations separate from real lead delivery.
The weekly workflow's `NETLIFY_BUILD_HOOK_URL` is a GitHub Actions repository
secret, configured separately from application environment variables.


## Resend delivery after Netlify form capture

`netlify/functions/submission-created.mjs` is the **only** form-event subscriber.
It uses Netlify's still-supported reserved filename convention and exports a
Lambda-compatible handler. The browser continues its single native POST to
Netlify Forms; do not restore the unused `resend.js` browser hook or configure
an outgoing webhook to call this event function as a second trigger.

The handler accepts a POST with this Netlify event envelope (other platform
metadata may be present):

```json
{
  "payload": {
    "id": "stable-netlify-submission-id",
    "form_id": "configured-contact-form-id",
    "form_name": "contact",
    "created_at": "2026-11-03T01:00:00Z",
    "data": {
      "form-name": "contact",
      "first_name": "Sample",
      "email": "sample@example.invalid",
      "help_with": "Website Design",
      "message": "A sample enquiry for local tests."
    }
  }
}
```

`payload.id` is the submission record ID, never a browser field or invocation ID.
The handler requires `payload.form_id` to match the configured contact form and
`payload.form_name` to equal `contact`. It rejects malformed required fields,
explicit spam metadata, and a filled honeypot. It does not independently verify
CAPTCHA: Netlify performs that check before raising the verified-submission
event. The client token check is not server verification.

Netlify's current typed `formSubmitted` event exposes only `data` in its published
interface. The legacy envelope retains metadata needed for stable idempotency.
Evidence: [supported event authentication and legacy convention](https://docs.netlify.com/build/functions/trigger-on-events/),
[official legacy payload example](https://www.netlify.com/blog/form-handling-nextjs-notion/),
and [submission record ID/schema](https://github.com/netlify/open-api/blob/master/swagger.yml).
The exact deployed envelope and contact form ID must still be checked on a
staging preview; do not enable sending if they differ. The implementation fails
closed when required metadata is missing. Netlify validates event JWS signatures
before invocation; no public alternate route is added and no browser-provided
`verified` field is trusted. Deployed forged-request rejection remains a required
preview test, not a property that unit tests prove.

Configure these additional variables in the **Functions** runtime scope:

| Variable | Safe default / meaning |
| --- | --- |
| `FORM_EMAIL_ENABLED` | `false`; only the exact value `true` enables attempts |
| `FORM_EMAIL_MODE` | `test`; omitted also defaults to test |
| `FORM_EMAIL_CONTACT_FORM_ID` | Required metadata ID of the intended Netlify contact form |
| `FORM_EMAIL_TEST_TO` | Required in test mode; both emails go to this controlled inbox |

Test mode prefixes subjects with `[TEST]`. It overrides both recipient addresses,
including the acknowledgement, without trusting any submitted override. Use the approved sender `noreply@getclever.marketing`. The internal email omits Reply-To. Only the acknowledgement
uses `RESEND_REPLY_TO_EMAIL` (`lets@getclever.marketing`). The two messages are
attempted independently using built-in fetch; no runtime dependency was added.

Production requires `FORM_EMAIL_ENABLED=true`, `FORM_EMAIL_MODE=live`,
`FORM_EMAIL_DEPLOY_CONTEXT=production` and `FORM_EMAIL_DEPLOY_BRANCH=main`, all
configured in Netlify's production context with Functions scope. The latter two
are custom runtime settings because Netlify's read-only `CONTEXT` and `BRANCH`
are build-only. Keep their values unset outside production; missing or different
runtime identity blocks live delivery. Keep non-production delivery disabled
(`FORM_EMAIL_ENABLED=false`) and in test mode (`FORM_EMAIL_MODE=test`). A separate staging Netlify project is preferable for event testing so
production submissions and the active production function cannot be involved.
No Netlify token or custom CAPTCHA/webhook secret is needed by this handler.

Each message has a separate Resend key:
`contact/<form-id>/<submission-id>/notification` or `/confirmation`.
Identical invocations reuse the same JSON body and keys. There are at most three
attempts per email, each with a two-second request timeout. Eligible network,
rate-limit, server, and concurrent-idempotency failures receive bounded backoff.
Retry-After is respected: values over one second defer recovery rather than
retry early. Permanent failures and payload/key conflicts are not retried.

Resend's deduplication window is **24 hours**, not permanent exactly-once delivery.
Keep the original message data, template and configuration stable during retry.
Changing a template or test/live mode while replaying the same submission can
produce a key/payload conflict; do not work around that by changing keys blindly.
No persistent queue or delivery ledger has been added. Logs contain only safe
submission/message IDs, purpose, mode, attempts and outcome/status—not enquiry
content, addresses, credentials or provider error text. An exhausted failure
returns 502 to the event invocation; it does not undo Netlify capture or prove
Netlify will automatically retry it. Monitor function failures and reconcile
against Resend IDs before manual recovery, particularly after 24 hours. API
acceptance also does not prove inbox delivery; inspect Resend delivery events.

Before enabling on a staging preview:

1. Inspect Netlify's contact-form notifications and identify overlapping native
   email notifications, outgoing webhooks, integrations or event subscribers.
   No hosted notification settings were accessible during local implementation.
2. Verify the form ID and actual event envelope using a controlled accepted
   submission. Keep delivery off until that contract matches the handler.
3. Configure a controlled test inbox and runtime settings, then enable **test**
   mode only. Ensure the native notification settings do not create duplicate
   internal emails; never disable Netlify form capture.
4. Verify one stored record, one internal notification, one acknowledgement,
   correct Reply-To behavior, direct/forged endpoint rejection, and no event
   delivery for rejected CAPTCHA, honeypot or spam. Confirm Netlify's behavior
   when an administrator changes a spam submission to verified.
5. Exercise partial failure and retry using stable IDs; inspect actual delivery
   events. Unit tests mock Resend and cannot validate hosted authentication,
   CAPTCHA, notification settings, real delivery, or platform retry guarantees.

Run local tests with `node --test tests/form-delivery.test.mjs`; they do not load
`.env` and never call external services. For rollback, set
`FORM_EMAIL_ENABLED=false` in the hosted runtime settings and redeploy the
previous reviewed artifact to apply it. Netlify Forms capture remains intact.
Previously queued/in-flight work may still finish. Restore any prior native
notification deliberately, without creating parallel active email delivery.
