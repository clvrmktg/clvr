// netlify/functions/meta-pixel.js
// Full-proxy Meta Pixel:
// - Fetches Meta's library server-side
// - Returns: fbevents.js + tiny bootstrap (init + first PageView + SPA helper)
// - Keeps the Pixel ID out of your HTML and off the network URL
// - Long-cacheable; bust via ?v=... from your loader

export const handler = async () => {
  const PIXEL_ID = process.env.META_PIXEL_ID;

  // Always return valid JS so the page doesn't break if env is missing
  if (!PIXEL_ID) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: "/* META_PIXEL_ID not set; pixel disabled */",
    };
  }

  try {
    // Fetch Meta's library server-side (US locale; change if you prefer)
    const upstream = await fetch("https://connect.facebook.net/en_US/fbevents.js");
    if (!upstream.ok) throw new Error(`fetch fbevents.js ${upstream.status}`);
    const lib = await upstream.text();

    // Append a minimal bootstrap:
    //  - init with your server-side ID
    //  - send the first PageView
    //  - expose a helper for SPA route changes
    const bootstrap = `
;(function(){
  try {
    if (typeof fbq !== "function") return;
    if (!window.__metaPixelInited) {
      window.__metaPixelInited = true;
      fbq('init', '${PIXEL_ID}');
      fbq('track', 'PageView');
    }
    window.metaPixelTrackPageView = function(){
      try { fbq('track', 'PageView'); } catch(e){}
    };
  } catch (e) {}
})();`.trim();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: lib + "\n" + bootstrap + "\n",
    };
  } catch (err) {
    // Fail safe: return a harmless JS comment (no 502/Bad Gateway)
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
      },
      body: `/* meta-pixel proxy error: ${String(err)} */`,
    };
  }
};
