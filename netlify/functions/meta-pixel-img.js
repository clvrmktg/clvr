// netlify/functions/meta-pixel-img.js
// Proxies Meta's /tr beacon so <noscript> doesn't expose your Pixel ID.

export const handler = async (event) => {
  const PIXEL_ID = process.env.META_PIXEL_ID;
  if (!PIXEL_ID) return { statusCode: 204 };

  const qs = event.queryStringParameters || {};
  const url = new URL("https://www.facebook.com/tr");
  url.searchParams.set("id", PIXEL_ID);
  url.searchParams.set("ev", qs.ev || "PageView");
  url.searchParams.set("noscript", "1");
  for (const [k, v] of Object.entries(qs)) {
    if (k !== "ev" && k !== "id") url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store",
    },
    body: buf.toString("base64"),
    isBase64Encoded: true,
  };
};
