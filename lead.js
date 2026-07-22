// Vercel serverless function: /api/lead  (CommonJS for zero-config Node runtime)
// Emails every lead to david@realestate904.com via Resend — including the
// partial (address-only) capture when a visitor doesn't finish the form.
//
// Env vars (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY    the re_... sending key
//   LEAD_TO_EMAIL     david@realestate904.com
//   LEAD_FROM_EMAIL   Kampmeyer Leads <leads@flsellfast.com>

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let lead = req.body;
  if (typeof lead === "string") { try { lead = JSON.parse(lead); } catch (e) { lead = {}; } }
  if (!lead || typeof lead !== "object") lead = {};

  const TO   = process.env.LEAD_TO_EMAIL   || "david@realestate904.com";
  const FROM = process.env.LEAD_FROM_EMAIL || "Kampmeyer Leads <leads@flsellfast.com>";
  const KEY  = process.env.RESEND_API_KEY;
  if (!KEY) return res.status(500).json({ error: "RESEND_API_KEY not configured" });

  const status = lead.status || "lead";
  const isPartial = status.indexOf("partial") === 0 || status === "abandoned";
  const subject = isPartial
    ? "🏠 New lead (address captured) — " + (lead.address || "unknown address")
    : "🔥 New CASH-OFFER lead — " + (lead.name || lead.address || "new seller");

  const esc = (v) => String(v).replace(/</g, "&lt;");
  const row = (k, v) => v ? '<tr><td style="padding:6px 14px 6px 0;color:#5b6875">' + k + '</td><td style="padding:6px 0;color:#1f2a37;font-weight:600">' + esc(v) + '</td></tr>' : "";
  const html =
    '<div style="font-family:Arial,sans-serif;max-width:560px">' +
      '<h2 style="color:#12395c;margin:0 0 4px">' + (isPartial ? "New lead — address captured" : "New completed lead") + '</h2>' +
      '<p style="color:#5b6875;margin:0 0 14px">Status: <b>' + status + '</b>' + (isPartial ? " — entered an address but may not have finished. Follow up fast!" : "") + '</p>' +
      '<table style="border-collapse:collapse;font-size:14px">' +
        row("Address", lead.address) + row("Name", lead.name) + row("Phone", lead.phone) + row("Email", lead.email) +
        row("Property type", lead.propertyType) +
        row("Beds / Baths", (lead.beds || lead.baths) ? ((lead.beds || "?") + " bd / " + (lead.baths || "?") + " ba") : "") +
        row("Condition", lead.condition) + row("Timeframe", lead.timeframe) +
        row("Balance owed", lead.balanceOwed) + row("Occupancy", lead.occupancy) +
        row("Submitted", lead.ts) + row("Source", lead.url) +
      '</table></div>';

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [TO], subject: subject, html: html, reply_to: lead.email || undefined })
    });
    if (!r.ok) { const t = await r.text(); return res.status(502).json({ error: "Resend send failed", detail: t }); }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
};
