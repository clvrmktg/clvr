(() => {
  const tag = document.currentScript;
  if (!tag) return;

  const pixelId = tag.dataset.pixelId;     // needed for fbq('init', ...)
  const version = tag.dataset.version || "";
  const locale = tag.dataset.locale || "en_US";
  if (!pixelId) return;

  // Define fbq immediately so calls queue until real script loads
  (function bootstrapFBQ() {
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
  })();

  // --- Rewrite helpers to force everything through our proxy ---
  const PROXY = "/.netlify/functions/meta-pixel";
  const rewrite = (url) => {
    try {
      const u = new URL(url, location.origin);
      if (u.hostname === "connect.facebook.net") {
        return PROXY + u.pathname + (u.search || "");
      }
      if (u.hostname === "www.facebook.com" && u.pathname.startsWith("/tr")) {
        return PROXY + u.pathname + (u.search || "");
      }
      return url;
    } catch {
      return url; // relative URLs etc.
    }
  };

  // 1) script src rewrites
  const _createElement = document.createElement.bind(document);
  document.createElement = function (name, opts) {
    const el = _createElement(name, opts);
    if (name === "script") {
      const _setAttribute = el.setAttribute.bind(el);
      el.setAttribute = function (k, v) {
        if (k === "src" && typeof v === "string") v = rewrite(v);
        return _setAttribute(k, v);
      };
      Object.defineProperty(el, "src", {
        set(v) { _setAttribute("src", rewrite(v)); },
        get() { return el.getAttribute("src"); }
      });
    }
    return el;
  };

  // 2) fetch rewrites
  const _fetch = window.fetch?.bind(window);
  if (_fetch) {
    window.fetch = (input, init) => {
      if (typeof input === "string") input = rewrite(input);
      else if (input && input.url) input = rewrite(input.url);
      return _fetch(input, init);
    };
  }

  // 3) XHR rewrites
  if (window.XMLHttpRequest) {
    const _open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      return _open.call(this, method, rewrite(url), ...rest);
    };
  }

  // 4) Image beacon rewrites
  const _imgSrc = Object.getOwnPropertyDescriptor(Image.prototype, "src");
  if (_imgSrc && _imgSrc.set) {
    Object.defineProperty(Image.prototype, "src", {
      set(v) { _imgSrc.set.call(this, rewrite(v)); },
      get() { return _imgSrc.get.call(this); }
    });
  }

  // --- Load the proxied fbevents.js (delayed) ---
  function loadPixel() {
    const s = document.createElement("script");
    s.async = true;
    s.src = `${PROXY}/${locale}/fbevents.js?v=${encodeURIComponent(version)}`;
    const first = document.getElementsByTagName("script")[0];
    first.parentNode.insertBefore(s, first);

    fbq("init", pixelId);
    fbq("track", "PageView");
  }

  if ("requestIdleCallback" in window) {
    requestIdleCallback(loadPixel, { timeout: 5000 });
  } else {
    setTimeout(loadPixel, 3000);
  }
})();
