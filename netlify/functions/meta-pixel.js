// netlify/functions/meta-pixel.js
export default async function handler(req, res) {
  const PIXEL_ID = process.env.META_PIXEL_ID;
  if (!PIXEL_ID) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    return res.end(`/* META_PIXEL_ID not set; no-op */`);
  }

  // Long cache (bust with ?v=hash from Hugo)
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

  // This script:
  //  - creates the fbq stub (queue only; no network yet)
  //  - on idle (or timeout fallback), injects Facebook's library
  //  - inits and sends the initial PageView
  //  - exposes a safe fbq wrapper for later calls (events)
  //  - optional: respects a consent flag window.__consent?.ad === true
  const js = `
(function(){
  if (window.__metaPixelLoaded) return;

  // ---- consent gate (optional): only initialize if allowed
  function hasAdConsent() {
    try { return !!(window.__consent && window.__consent.ad === true); }
    catch (e) { return true; } // default allow if you don't use consent
  }

  // fbq stub (queue only)
  (function(f,b){
    if (f.fbq) return;
    var n = f.fbq = function(){ n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = false; n.version = '2.0'; n.queue = [];
  })(window, document);

  // loader
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
    if (!hasAdConsent()) return; // don't initialize if consent says no
    if (!window.fbq) return;
    // Initialize
    fbq('init', '${PIXEL_ID}');
    // First hit
    fbq('track', 'PageView');
  }

  function onIdle(fn){
    if ('requestIdleCallback' in window) {
      requestIdleCallback(fn, { timeout: 5000 });
    } else {
      setTimeout(fn, 3000);
    }
  }

  // load FB lib after idle, then init
  onIdle(function(){
    loadPixel();
    // In case the lib is not immediately ready, attempt init a few times
    var tries = 0;
    (function waitForFB(){
      if (typeof fbq === 'function' && fbq.callMethod) { // fbq real is present
        try { initAndTrack(); } catch(e){}
      } else if (tries++ < 20) {
        setTimeout(waitForFB, 150);
      }
    })();
  });

  // Optional: SPA virtual pageviews helper
  // Call window.metaPixelTrackPageView() yourself on route changes.
  window.metaPixelTrackPageView = function(){
    try { if (typeof fbq === 'function') fbq('track', 'PageView'); } catch(e){}
  };
})();
  `.trim();

  return res.end(js);
}
