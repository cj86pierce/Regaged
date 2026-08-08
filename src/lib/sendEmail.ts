import sgMail from "@sendgrid/mail";

export function getSendGridConfig() {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey) return { ok: false as const, error: "Server missing SENDGRID_API_KEY" };
  if (!from) return { ok: false as const, error: "Server missing EMAIL_FROM" };
  return { ok: true as const, apiKey, from };
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}) {
  const cfg = getSendGridConfig();
  if (!cfg.ok) return { ok: false as const, error: cfg.error };

  sgMail.setApiKey(cfg.apiKey);
  const to = Array.isArray(opts.to) ? opts.to : [opts.to];
  if (!to.length) return { ok: true as const, sent: 0 };

  try {
    await sgMail.send({
      to,
      from: cfg.from,
      subject: opts.subject,
      text: opts.text,
      html: opts.html ?? `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(opts.text)}</pre>`,
    });
    return { ok: true as const, sent: to.length };
  } catch (err: unknown) {
    const e = err as { response?: { body?: unknown; statusCode?: number }; message?: string };
    console.error("SendGrid send failed:", e?.response?.body ?? e);
    return { ok: false as const, error: "Email send failed. Check SendGrid / EMAIL_FROM." };
  }
}

/** Send one email per recipient (BCC-style privacy via separate sends), batched. */
export async function sendEmailBlast(opts: {
  recipients: string[];
  subject: string;
  text: string;
  html?: string;
  batchSize?: number;
}) {
  const cfg = getSendGridConfig();
  if (!cfg.ok) return { ok: false as const, error: cfg.error, sent: 0, failed: 0 };

  sgMail.setApiKey(cfg.apiKey);
  const batchSize = Math.max(1, Math.min(100, opts.batchSize ?? 50));
  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;

  for (let i = 0; i < opts.recipients.length; i += batchSize) {
    const chunk = opts.recipients.slice(i, i + batchSize);
    const personalizations = chunk.map((email) => ({ to: [{ email }] }));
    try {
      await sgMail.send({
        personalizations,
        from: cfg.from,
        subject: opts.subject,
        text: opts.text,
        html:
          opts.html ??
          `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;white-space:pre-wrap">${escapeHtml(opts.text)}</div>`,
      } as Parameters<typeof sgMail.send>[0]);
      sent += chunk.length;
    } catch (err: unknown) {
      failed += chunk.length;
      const e = err as { response?: { body?: unknown } };
      console.error("SendGrid blast batch failed:", e?.response?.body ?? err);
      lastError = "Some emails failed to send.";
    }
  }

  if (sent === 0 && failed > 0) {
    return { ok: false as const, error: lastError ?? "Email send failed.", sent, failed };
  }
  return { ok: true as const, sent, failed };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
