// Minimal IndexNow plugin (ESM)
// Uses onSuccess so the deployed URLs are live.

const postIndexNow = async ({ site, key, urlList }) => {
  const host = new URL(site).host;
  const keyLocation = `${site.replace(/\/$/, "")}/${key}.txt`;

  const body = { host, key, keyLocation, urlList };

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IndexNow error ${res.status}: ${text}`);
  }
};

const getUrlsFromSitemap = async (sitemapUrl) => {
  if (!sitemapUrl) return [];
  try {
    const res = await fetch(sitemapUrl);
    if (!res.ok) return [];
    const xml = await res.text();
    return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1]).slice(0, 1000);
  } catch {
    return [];
  }
};

export const onSuccess = async ({ inputs, utils }) => {
  const { site, key, sitemap } = inputs;

  if (!site || !key) {
    utils.status.show({
      title: "IndexNow skipped",
      summary: "Missing required inputs: site and/or key."
    });
    return;
  }

  // Warn if the key file isn’t public
  try {
    const keyUrl = `${site.replace(/\/$/, "")}/${key}.txt`;
    const head = await fetch(keyUrl, { method: "HEAD" });
    if (!head.ok) {
      utils.status.show({
        title: "IndexNow warning",
        summary: `Key file not reachable at ${keyUrl}. Ensure Hugo /static/${key}.txt exists.`
      });
    }
  } catch { /* non-fatal */ }

  let urlList = await getUrlsFromSitemap(sitemap);
  if (!urlList.length) urlList = [site.replace(/\/$/, "") + "/"];

  try {
    await postIndexNow({ site, key, urlList });
    utils.status.show({
      title: "IndexNow submitted",
      summary: `Submitted ${urlList.length} URL(s) to IndexNow.`
    });
  } catch (error) {
    utils.build.failPlugin("IndexNow submission failed", { error });
  }
};
