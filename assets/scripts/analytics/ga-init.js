// assets/scripts/ga-init.js
(() => {
  const tag = document.currentScript;
  if (!tag) return;

  const gaId = tag.dataset.gaId;
  const version = tag.dataset.version || "";

  if (!gaId) return; // nothing to do if GA ID is missing

  function loadGA() {
    const script = document.createElement("script");
    script.src = `/.netlify/functions/gtag?v=${encodeURIComponent(version)}`;
    script.async = true;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag(){ window.dataLayer.push(arguments); }
    window.gtag = gtag;

    gtag("js", new Date());
    gtag("config", gaId);
  }

  if ("requestIdleCallback" in window) {
    requestIdleCallback(loadGA, { timeout: 5000 });
  } else {
    setTimeout(loadGA, 3000);
  }
})();
