// netlify/functions/meta-pixel.js
//
// Endpoints:
//   /.netlify/functions/meta-pixel-js
//       → Proxies https://connect.facebook.net/en_US/fbevents.js
//
//   /.netlify/functions/meta-pixel/tr?ev=PageView&... (id auto-injected)
//       → Proxies https://www.facebook.com/tr?...
//
// ENV:
//   META_PIXEL_ID = "123456789012345"  // required for /tr
//
// Notes:
// - The JS file is cached aggressively (1 year, immutable).
// - The /tr endpoint does NOT cache. It forwards request details for better match rate.
// - You can localize the JS by adding ?locale=xx_YY to the -js URL, defaults to en_US.
// - Use the -js endpoint from your HTML (or Partytown).
// - Use the /tr endpoint for noscript beacons and manual events.
//

const CONNECT_BASE = "https://connect.facebook.net";
const FB_BASE = "https://www.facebook.com";

/** Return a JSON response (primarily for debugging). */
function json(status, data) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(data),
  };
}

/** Extract client IP as seen by Netlify. */
function getClientIp(headers) {
  return (
    headers["x-nf-client-connection-ip"] ||
    headers["x-client-ip"] ||
    (headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    ""
  );
}

/** Utilities to build a clean search string with defaults applied. */
function buildTrQuery(original, pixelId, referrer, ua, ip) {
  const qs = new URLSearchParams(original || {});
  // Ensure Pixel ID exists (Meta expects `id` param)
  if (!qs.get("id")) qs.set("id", pixelId);
  // Default event
  if (!qs.get("ev")) qs.set("ev", "PageView");
  // Best-effort enrich (Meta supports many optional params)
  if (!qs.get("dl") && referrer) qs.set("dl", referrer); // document location
  // (Optional) Pass-through hints; Meta infers a lot from headers already.
  // We'll keep query clean and rely on headers.
  return qs.toString();
}

/** Proxies the Meta Pixel JS with long-lived caching. */
async function handleJs(event) {
  const url = new URL(event.rawUrl || `https://${event.headers.host}${event.path}`);
  const locale = url.searchParams.get("locale") || "en_US";
  const upstream = `${CONNECT_BASE}/${locale}/fbevents.js`;

  const r = await fetch(upstream, {
    method: "GET",
    headers: {
      // Help caches de-duplicate
      "Accept": "application/javascript, text/javascript;q=0.9, */*;q=0.8",
    },
  });

  if (!r.ok) {
    return json(r.status, { error: "Failed to fetch fbevents.js" });
  }

  const body = await r.text();

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Cache for a year; file is fingerprinted upstream & we proxy as-is
      "Cache-Control": "public, max-age=31536000, immutable",
      // Allow embedding from your site only (tweak as needed)
      "Vary": "Accept",
    },
    body,
  };
}

/** Proxies the tracking beacon (/tr) to Facebook and relays the GIF back. */
async function handleTr(event) {
  const PIXEL_ID = process.env.META_PIXEL_ID;
  if (!PIXEL_ID) {
    // Silently no-op to avoid breaking pages if env is missing
    return { statusCode: 204 };
  }

  const headers = event.headers || {};
  const ref = headers["referer"] || headers["referrer"] || "";
  const ua = headers["user-agent"] || "";
  const ip = getClientIp(headers);

  // Build query string with our defaults applied
  const qs = buildTrQuery(event.queryStringParameters, PIXEL_ID, ref, ua, ip);
  const upstream = `${FB_BASE}/tr?${qs}`;

  // Proxy the request to Facebook. We set relevant headers for better matching.
  const r = await fetch(upstream, {
    method: "GET",
    headers: {
      "User-Agent": ua || "Mozilla/5.0",
      "Referer": ref || "",
      "X-Forwarded-For": ip || "",
      "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "Accept-Language": headers["accept-language"] || "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
  });

  // If FB returns the 1x1 gif, relay it; otherwise, 204.
  if (r.ok) {
    const buf = await r.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, max-age=0",
      },
      body: b64,
      isBase64Encoded: true,
    };
  }

  // No content if FB rejects (avoid blocking page load)
  return { statusCode: 204 };
}

export async function handler(event) {
  try {
    const path = event.path || "";
    // Normalize to avoid differing site paths:
    // - "/.netlify/functions/meta-pixel-js"
    // - "/.netlify/functions/meta-pixel/js"
    // - "/.netlify/functions/meta-pixel/tr"
    if (path.endsWith("/meta-pixel-js") || path.endsWith("/meta-pixel/js")) {
      return await handleJs(event);
    }
    if (path.includes("/meta-pixel/tr")) {
      return await handleTr(event);
    }

    // Help: show simple usage if someone hits the root
    if (path.endsWith("/meta-pixel")) {
      return json(200, {
        ok: true,
        usage: {
          js: "/.netlify/functions/meta-pixel-js?locale=en_US",
          track: "/.netlify/functions/meta-pixel/tr?ev=PageView",
        },
      });
    }

    return { statusCode: 404, body: "Not Found" };
  } catch (err) {
    return json(500, { error: err?.message || "Unknown error" });
  }
}
