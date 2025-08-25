const BASE = "https://connect.facebook.net";
const BEACON = "https://www.facebook.com";
const PIXEL_ID = process.env.META_PIXEL_ID || "";

export async function handler(event) {
  try {
    // Strip the function mount path and ensure a leading slash
    let path = event.path.replace(/^\/.netlify\/functions\/meta-pixel/, "");
    if (!path.startsWith("/")) path = "/" + path;

    const qs = new URLSearchParams(event.queryStringParameters || {});

    // Beacon: ensure id present (hide it from HTML)
    if (path.startsWith("/tr")) {
      if (PIXEL_ID && !qs.get("id")) qs.set("id", PIXEL_ID);
      const url = `${BEACON}${path}?${qs.toString()}`;
      const res = await fetch(url, { headers: defaultHeaders() });
      const buf = Buffer.from(await res.arrayBuffer());

      return {
        statusCode: res.status,
        headers: passThroughHeaders(res.headers, {
          "Content-Type": res.headers.get("content-type") || "image/gif",
          "Cache-Control": "no-store",
        }),
        body: buf.toString("base64"),
        isBase64Encoded: true,
      };
    }

    // Everything else (fbevents.js, signals/config, plugins, etc.)
    const upstream = `${BASE}${path}${qs.toString() ? "?" + qs.toString() : ""}`;
    const res = await fetch(upstream, { headers: defaultHeaders() });

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const isText =
      contentType.includes("javascript") ||
      contentType.includes("json") ||
      contentType.startsWith("text/");

    if (isText) {
      const body = await res.text();
      // Favor upstream headers; set sane defaults if missing
      const headers = passThroughHeaders(res.headers, {
        "Content-Type": contentType || "application/javascript; charset=utf-8",
        "Cache-Control":
          res.headers.get("cache-control") || "public, max-age=31536000, immutable",
      });
      return { statusCode: res.status, headers, body };
    } else {
      const buf = Buffer.from(await res.arrayBuffer());
      const headers = passThroughHeaders(res.headers, {
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control": res.headers.get("cache-control") || "no-store",
      });
      return {
        statusCode: res.status,
        headers,
        body: buf.toString("base64"),
        isBase64Encoded: true,
      };
    }
  } catch (e) {
    return { statusCode: 502, body: "Proxy error" };
  }
}

function defaultHeaders() {
  return { "User-Agent": "Mozilla/5.0 Netlify-Proxy" };
}

function passThroughHeaders(src, overrides) {
  const headers = {};
  // Copy a few safe headers through
  for (const key of ["content-type", "cache-control", "etag", "last-modified"]) {
    const v = src.get(key);
    if (v) headers[titleCase(key)] = v;
  }
  return { ...headers, ...overrides };
}

function titleCase(h) {
  return h.replace(/\b\w/g, c => c.toUpperCase()).replace(/-/g, "-");
}
