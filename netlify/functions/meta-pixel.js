// netlify/functions/meta-pixel.js
const BASE = "https://connect.facebook.net";
const BEACON = "https://www.facebook.com";
const PIXEL_ID = process.env.META_PIXEL_ID;

export async function handler(event) {
  try {
    let path = event.path.replace(/^\/.netlify\/functions\/meta-pixel/, "");
    if (!path.startsWith("/")) path = "/" + path;
    const qs = new URLSearchParams(event.queryStringParameters || {});

    // Special case: /tr beacon requests → inject Pixel ID automatically
    if (path.startsWith("/tr")) {
      if (PIXEL_ID) qs.set("id", PIXEL_ID);
      const upstream = `${BEACON}${path}?${qs.toString()}`;
      const res = await fetch(upstream, {
        headers: { "User-Agent": "Mozilla/5.0 Netlify-Proxy" },
      });
      const buf = Buffer.from(await res.arrayBuffer());

      return {
        statusCode: res.status,
        headers: {
          "Content-Type": res.headers.get("content-type") || "image/gif",
          "Cache-Control": "no-store",
        },
        body: buf.toString("base64"),
        isBase64Encoded: true,
      };
    }

    // Otherwise, proxy JS/config/plugin requests
    const upstream = `${BASE}${path}${qs.toString() ? "?" + qs : ""}`;
    const res = await fetch(upstream, {
      headers: { "User-Agent": "Mozilla/5.0 Netlify-Proxy" },
    });
    const buf = Buffer.from(await res.arrayBuffer());

    return {
      statusCode: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/javascript",
        "Cache-Control": res.headers.get("cache-control") || "public, max-age=31536000, immutable",
      },
      body: buf.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 502, body: "Proxy error" };
  }
}
