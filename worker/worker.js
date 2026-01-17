export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin, env);

    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "POST") return json(404, { ok: false, error: "Not Found" }, headers);

    try {
      const ct = (request.headers.get("Content-Type") || "").toLowerCase();
      if (!ct.includes("application/json")) {
        return json(400, { ok: false, error: "Content-Type must be application/json" }, headers);
      }

      const body = await request.json();

      if (body.type === "email") {
        const { sendTo, subject, text, html } = body || {};
        if (!sendTo || !subject || !text) {
          return json(400, { ok: false, error: "Missing fields: sendTo, subject, text" }, headers);
        }

        if (!env.RESEND_API_KEY) {
          return json(500, { ok: false, error: "Missing env var: RESEND_API_KEY" }, headers);
        }

        // IMPORTANT:
        // For testing you can use: FROM_EMAIL = "onboarding@resend.dev"
        // For production you should use a verified domain sender (Resend dashboard).
        const fromEmail = String(env.FROM_EMAIL || "onboarding@resend.dev").trim();
        const fromName = String(env.FROM_NAME || "Flydubai Contact Centre").trim();
        const from = `${fromName} <${fromEmail}>`;

        const payload = {
          from,
          to: [String(sendTo).trim()],
          subject: String(subject),
          text: String(text),
          html: html ? String(html) : String(text).replace(/\n/g, "<br>")
        };

        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const raw = await r.text();
        let data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch (_) {}

        if (!r.ok) {
          // Resend typically returns { message: "...", name: "...", statusCode: ... } or { error: {...} }
          const msg =
            (data && (data.message || (data.error && (data.error.message || data.error)))) ||
            raw ||
            "Resend error";

          return json(502, { ok: false, error: msg }, headers);
        }

        return json(200, { ok: true, id: data && data.id ? data.id : undefined }, headers);
      }

      return json(400, { ok: false, error: "Unknown type" }, headers);
    } catch (e) {
      return json(500, { ok: false, error: e?.message || "Server error" }, headers);
    }
  }
};

function corsHeaders(origin, env) {
  const list = String(env.ALLOWED_ORIGIN || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const allow = list.length === 0 || list.includes(origin);

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
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
