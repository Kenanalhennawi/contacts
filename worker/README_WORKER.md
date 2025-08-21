# Cloudflare Worker (Email + WhatsApp)

## Variables
- ALLOWED_ORIGIN = http://localhost:5500 (dev) or your production site URL
- SENDGRID_API_KEY = <SendGrid API Key>
- FROM_EMAIL = no-reply@yourdomain.com (verified in SendGrid)
- FROM_NAME = Flydubai Contact Centre
- WHATSAPP_TOKEN = <Meta WhatsApp Cloud API token>
- WHATSAPP_PHONE_NUMBER_ID = <Phone Number ID from Meta>

## Deploy
1) Cloudflare Dashboard → Workers & Pages → Create Worker → paste `worker.js`.
2) Add Variables above in **Settings → Variables**.
3) Save & Deploy. Copy the Worker URL and set it in `index.html` → `window.CONFIG.WORKER_URL`.

## Test
Email:
```bash
curl -X POST "https://YOUR-WORKER.workers.dev" \
  -H "Content-Type: application/json" \
  -d '{
    "type":"email",
    "sendTo":"test@example.com",
    "subject":"Test",
    "text":"Hello from Worker"
  }'
