// netlify/functions/meta-pixel.mjs
export const handler = async (event) => {
  try {
    // Optional: support ?l=en_US (defaults to en_US)
    const locale = (event.queryStringParameters?.l || "en_US").replace(/[^a-zA-Z_]/g, "") || "en_US";
    const upstream = `https://connect.facebook.net/${locale}/fbevents.js`;

    const res = await fetch(upstream, { method: "GET" });
    const body = await res.text();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        // You’ll usually call with a version query (e.g. ?v=gitHash), so it’s safe to cache long
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body,
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
      body: "// Meta Pixel proxy failed to load.",
    };
  }
};
