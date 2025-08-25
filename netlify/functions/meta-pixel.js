// netlify/functions/meta-pixel.js
export const handler = async () => {
  const PIXEL_ID = process.env.META_PIXEL_ID;
  if (!PIXEL_ID) {
    return { statusCode: 200, headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=31536000, immutable" }, body: "/* META_PIXEL_ID not set; pixel disabled */" };
  }
  try {
    const upstream = await fetch("https://connect.facebook.net/en_US/fbevents.js");
    if (!upstream.ok) throw new Error(`fetch fbevents.js ${upstream.status}`);
    const lib = await upstream.text();

    const stub = `(function(f,b){if(f.fbq)return;var n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=false;n.version='2.0';n.queue=[]})(window,document);`;

    const bootstrap = `;(function(){try{if(typeof fbq!=='function')return;if(!window.__metaPixelInited){window.__metaPixelInited=true;fbq('init','${PIXEL_ID}');fbq('track','PageView')}window.metaPixelTrackPageView=function(){try{fbq('track','PageView')}catch(e){}}}catch(e){}})();`;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=31536000, immutable" },
      body: stub + "\n" + lib + "\n" + bootstrap + "\n",
    };
  } catch (err) {
    return { statusCode: 200, headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" }, body: `/* meta-pixel proxy error: ${String(err)} */` };
  }
};
