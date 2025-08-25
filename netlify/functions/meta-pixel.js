// Proxies the 1x1 beacon so the Pixel ID never appears in HTML
export const handler = async (event) => {
  const PIXEL_ID = process.env.META_PIXEL_ID;
  if (!PIXEL_ID) return { statusCode: 204 };

  // Allow ev=PageView etc. (default PageView)
  const qs = event.queryStringParameters || {};
  const ev = qs.ev || "PageView";

  const url = new URL("https://www.facebook.com/tr");
  url.searchParams.set("id", PIXEL_ID);
  url.searchParams.set("ev", ev);
  url.searchParams.set("noscript", "1");

  // Forward any extra params except id
  for (const [k, v] of Object.entries(qs)) {
    if (k !== "ev") url.searchParams.set(k, v);
  }

  // Fetch the 1x1 GIF and stream it back
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
