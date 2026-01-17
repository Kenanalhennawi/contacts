export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = cors(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== "POST") {
      return respond(404, { ok: false, error: "Not Found" }, headers);
    }

    const type = (request.headers.get("Content-Type") || "").toLowerCase();
    if (!type.includes("application/json")) {
      return respond(400, { ok: false, error: "Invalid content type" }, headers);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return respond(400, { ok: false, error: "Invalid JSON" }, headers);
    }

    if (body.type !== "email") {
      return respond(400, { ok: false, error: "Unsupported request" }, headers);
    }

    if (!env.RESEND_API_KEY) {
      return respond(500, { ok: false, error: "Missing RESEND_API_KEY" }, headers);
    }

    const sendTo = String(body.sendTo || "").trim();
    const subject = String(body.subject || "").trim();
    const text = String(body.text || "").trim();

    if (!sendTo || !subject || !text) {
      return respond(400, { ok: false, error: "Missing fields" }, headers);
    }

    const fromEmail = String(env.FROM_EMAIL || "onboarding@resend.dev").trim();
    const fromName = String(env.FROM_NAME || "Flydubai Contact Centre").trim();

    const payload = {
      from: `${clean(fromName)} <${fromEmail}>`,
      to: [sendTo],
      subject,
      text,
      html: text.replace(/\n/g, "<br>")
    };

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const raw = await r.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = raw; }

    if (!r.ok) {
      return respond(502, { ok: false, error: data }, headers);
    }

    return respond(200, { ok: true, id: data.id }, headers);
  }
};

function cors(origin, env) {
  const list = String(env.ALLOWED_ORIGIN || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);

  const allowed = list.length === 0 || list.includes(origin);

  return {
    "Access-Control-Allow-Origin": allowed ? origin : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function respond(status, data, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" }
  });
}

function clean(v) {
  return String(v || "").replace(/[\r\n]+/g, " ").trim();
}
