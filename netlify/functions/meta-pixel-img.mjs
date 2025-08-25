// netlify/functions/meta-pixel-img.mjs
const PIXEL_ID = process.env.META_PIXEL_ID;

export const handler = async (event) => {
  try {
    if (!PIXEL_ID) {
      return { statusCode: 204 }; // no-op if not configured
    }

    // Pass through common query params (ev, noscript, etc.)
    const qs = new URLSearchParams(event.queryStringParameters || {});
    // Ensure Pixel ID is always present
    qs.set("id", PIXEL_ID);
    // FB expects 'tr?id=...' but also accepts 'id' in practice; we’ll do the canonical form:
    const url = `https://www.facebook.com/tr?${qs.toString().replace(/^id=/, "id=")}`;

    const res = await fetch(url, { method: "GET" });
    const buf = Buffer.from(await res.arrayBuffer());

    return {
      statusCode: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/gif",
        // These beacons shouldn’t be cached long by browsers/proxies
        "Cache-Control": "no-store, max-age=0",
      },
      body: buf.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 204 };
  }
};
