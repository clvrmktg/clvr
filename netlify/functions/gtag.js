// netlify/functions/gtag.js
export const handler = async () => {
  const GA_ID = process.env.GA_TRACKING_ID;

  // Always return a 200 with JS so the page never breaks
  if (!GA_ID) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=UTF-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: '/* Missing GA_TRACKING_ID; GA disabled */',
    };
  }

  // Load Google's library
  const res = await fetch(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`);
  const lib = await res.text();

  // Append bootstrap + config so the client doesn't need the ID
  const bootstrap = `
    // GA bootstrap + config added by Netlify Function
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', '${GA_ID}', { transport_type: 'beacon' });
  `;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=UTF-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    body: lib + bootstrap,
  };
};
