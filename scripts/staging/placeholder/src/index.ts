// Staging placeholder: a static, noindex page and a disallow-all robots.txt. Nothing else.
const headers = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
};

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>mktbd staging placeholder</title></head>
<body style="margin:0;font-family:system-ui,sans-serif"><div style="background:#b91c1c;color:#fff;padding:12px 16px;font-weight:600">STAGING PLACEHOLDER — not the live mktbd site. The test application is not deployed here yet.</div></body></html>`;

const placeholder = {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed", { status: 405, headers: { ...headers, Allow: "GET, HEAD" } });
    if (new URL(request.url).pathname === "/robots.txt")
      return new Response("User-agent: *\nDisallow: /\n", { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
    return new Response(page, { status: 200, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
  },
};

export default placeholder;
