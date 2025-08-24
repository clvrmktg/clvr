// netlify/functions/meta-pixel.js
export const handler = async () => {
  try {
    const PIXEL_ID = process.env.META_PIXEL_ID;

    // Always return a 200 with JS (so your <script> never 404s/502s)
    if (!PIXEL_ID) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
        body: '/* META_PIXEL_ID not set; no-op */',
      };
    }

    const js = `
(function(){
  if (window.__metaPixelLoaded) return;

  function hasAdConsent() {
    try { return !!(window.__consent && window.__consent.ad === true); }
    catch (e) { return true; }
  }

  (function(f,b){
    if (f.fbq) return;
    var n = f.fbq = function(){ n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = false; n.version = '2.0'; n.queue = [];
  })(window, document);

  function loadPixel(){
    if (window.__metaPixelLoaded) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    var x = document.getElementsByTagName('script')[0];
    x.parentNode.insertBefore(s, x);
    window.__metaPixelLoaded = true;
  }

  function initAndTrack(){
    if (!hasAdConsent()) return;
    if (!window.fbq) return;
    fbq('init', '${PIXEL_ID}');
    fbq('track', 'PageView');
  }

  function onIdle(fn){
    if ('requestIdleCallback' in window) {
      requestIdleCallback(fn, { timeout: 5000 });
    } else {
      setTimeout(fn, 3000);
    }
  }

  onIdle(function(){
    loadPixel();
    var tries = 0;
    (function waitForFB(){
      if (typeof fbq === 'function' && fbq.callMethod) {
        try { initAndTrack(); } catch(e){}
      } else if (tries++ < 20) {
        setTimeout(waitForFB, 150);
      }
    })();
  });

  window.metaPixelTrackPageView = function(){
    try { if (typeof fbq === 'function') fbq('track', 'PageView'); } catch(e){}
  };
})();
`.trim();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: js,
    };
  } catch (err) {
    // Surface an error as JS comment instead of 502
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      body: `/* meta-pixel error: ${String(err)} */`,
    };
  }
};
