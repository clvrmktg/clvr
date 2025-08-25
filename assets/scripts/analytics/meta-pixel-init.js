// assets/scripts/analytics/meta-pixel-init.js
(() => {
  const tag = document.currentScript;
  if (!tag) return;

  const pixelId = tag.dataset.pixelId;
  const version = tag.dataset.version || "";
  const locale = tag.dataset.locale || "en_US";

  if (!pixelId) return;

  // Define fbq immediately so calls can be queued
  function bootstrapFBQ() {
    if (window.fbq) return;
    const n = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    window.fbq = n;
    window._fbq = n;
  }

  function loadPixel() {
    bootstrapFBQ();

    // Override Facebook endpoints to use our proxy
    const originalCreateElement = document.createElement;
    document.createElement = function (tagName, options) {
      const el = originalCreateElement.call(document, tagName, options);
      if (tagName === "script") {
        Object.defineProperty(el, "src", {
          set(v) {
            // Rewrite connect.facebook.net to proxy
            if (v.includes("connect.facebook.net")) {
              el.setAttribute(
                "src",
                v.replace("https://connect.facebook.net", "/.netlify/functions/meta-pixel")
              );
            } else {
              el.setAttribute("src", v);
            }
          },
        });
      }
      return el;
    };

    // Inject the proxied fbevents.js
    const s = document.createElement("script");
    s.async = true;
    s.src = `/.netlify/functions/meta-pixel/${locale}/fbevents.js?v=${encodeURIComponent(version)}`;

    const first = document.getElementsByTagName("script")[0];
    first.parentNode.insertBefore(s, first);

    // Queue calls; flushed when script loads
    fbq("init", pixelId);
    fbq("track", "PageView");
  }

  if ("requestIdleCallback" in window) {
    requestIdleCallback(loadPixel, { timeout: 5000 });
  } else {
    setTimeout(loadPixel, 3000);
  }
})();
