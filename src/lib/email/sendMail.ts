import sgMail from "@sendgrid/mail";

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

export async function sendMail(input: SendMailInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey) return { ok: false, error: "missing_SENDGRID_API_KEY" };
  if (!from) return { ok: false, error: "missing_EMAIL_FROM" };

  sgMail.setApiKey(apiKey);
  try {
    await sgMail.send({
      to: input.to,
      from,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { ok: true };
  } catch (err: unknown) {
    const e = err as { response?: { body?: unknown }; message?: string };
    console.error("SendGrid send failed:", e?.response?.body ?? e);
    return { ok: false, error: e?.message ?? "send_failed" };
  }
}
