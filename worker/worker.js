// Cloudflare Worker — Email sender (SendGrid) with CORS for local + prod
// Env vars required (Workers → Settings → Variables):
//  - SENDGRID_API_KEY   (Secret)
//  - FROM_EMAIL         (Text)   e.g., no-reply@yourdomain.com  (verified in SendGrid)
//  - FROM_NAME          (Text)   e.g., Flydubai Contact Centre
//  - ALLOWED_ORIGIN     (Text)   e.g., http://localhost:5500,https://<your-gh-username>.github.io

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }
    if (request.method !== "POST") {
      return json(404, { ok: false, error: "Not Found" }, headers);
    }

    try {
      const ct = (request.headers.get("Content-Type") || "").toLowerCase();
      if (!ct.includes("application/json")) {
        return json(400, { ok: false, error: "Content-Type must be application/json" }, headers);
      }

      // Expected body from frontend:
      // { sendTo: "user@example.com", subject: "Subject", text: "Plain text", html?: "<p>HTML</p>" }
      const { sendTo, subject, text, html } = await request.json();

      // Basic validation
      if (!sendTo || !subject || !text) {
        return json(400, { ok: false, error: "Missing fields: sendTo, subject, text are required" }, headers);
      }
      if (text.length > 8000 || (html && html.length > 20000)) {
        return json(413, { ok: false, error: "Message too large" }, headers);
      }

      // Build SendGrid payload
      const payload = {
        personalizations: [{ to: [{ email: sendTo }] }],
        from: { email: env.FROM_EMAIL, name: env.FROM_NAME || "Website" },
        subject,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html || text.replace(/\n/g, "<br>") }
        ]
      };

      const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!r.ok) {
        const err = await r.text();
        return json(502, { ok: false, error: err || "SendGrid error" }, headers);
      }

      return json(200, { ok: true }, headers);
    } catch (e) {
      return json(500, { ok: false, error: e.message || "Server error" }, headers);
    }
  }
};

function corsHeaders(origin, env) {
  // ALLOWED_ORIGIN can be a single origin or comma-separated list
  const allowedList = String(env.ALLOWED_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
  const allow = allowedList.length === 0 || allowedList.includes(origin);
  return {
    "Access-Control-Allow-Origin": allow ? origin : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(status, obj, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" }
  });
}
