export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export function siteBaseUrl(): string {
  const raw = (process.env.NEXTAUTH_URL || process.env.BASE_URL || "https://regaged.com").trim();
  return raw.replace(/\/$/, "");
}

/** Send via SendGrid REST — avoid bundling @sendgrid/mail into instrumentation. */
export async function sendMail(input: SendMailInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey) return { ok: false, error: "missing_SENDGRID_API_KEY" };
  if (!from) return { ok: false, error: "missing_EMAIL_FROM" };

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.to }] }],
        from: { email: from },
        subject: input.subject,
        content: [
          { type: "text/plain", value: input.text },
          { type: "text/html", value: input.html },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("SendGrid REST send failed:", res.status, body);
      return { ok: false, error: `sendgrid_${res.status}` };
    }
    return { ok: true };
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("SendGrid send failed:", e);
    return { ok: false, error: e?.message ?? "send_failed" };
  }
}
