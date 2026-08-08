import { prisma } from "@/lib/prisma";
import { sendMail, siteBaseUrl } from "@/lib/email/sendMail";

const GAME_LABELS: Record<string, string> = {
  FASTING: "Fastings",
  CASTING: "Castings",
  FROOKIES: "Frookies",
  ROOKIES: "Rookies",
  SURVIVOR: "Survivor",
  FASTING_BOT: "Fastings (Practice)",
  CASTING_BOT: "Castings (Practice)",
  FROOKIES_BOT: "Frookies (Practice)",
  ROOKIES_BOT: "Rookies (Practice)",
  SURVIVOR_BOT: "Survivor (Practice)",
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function gameStartedHtml(opts: {
  username: string;
  gameLabel: string;
  gameNumber: number;
  gameUrl: string;
}) {
  const name = escapeHtml(opts.username);
  const label = escapeHtml(opts.gameLabel);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your Regaged game has started</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e5ea;border-radius:4px;overflow:hidden;">
          <tr>
            <td style="background:#111827;padding:28px 32px;text-align:center;">
              <div style="font-family:Georgia,serif;font-size:28px;letter-spacing:0.12em;color:#f8fafc;font-weight:700;">REGAGED</div>
              <div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#9ca3af;">Game notification</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Hi ${name},</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">
                Your <strong>${label}</strong> lobby is full and the game has started.
              </p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#4b5563;">
                Game #${opts.gameNumber}. Open the house now so you don’t miss the first phase.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                <tr>
                  <td style="background:#111827;border-radius:4px;">
                    <a href="${opts.gameUrl}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.04em;color:#ffffff;text-decoration:none;">
                      Enter game
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b7280;">
                Or paste this link into your browser:
              </p>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;">
                <a href="${opts.gameUrl}" style="color:#1d4ed8;">${opts.gameUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#9ca3af;text-align:center;">
              You’re receiving this because you enrolled in a Regaged game.<br />
              © Regaged
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Email every human player that the game has started.
 * Idempotent via Game.startEmailSentAt.
 */
export async function notifyGameStarted(gameId: string): Promise<void> {
  try {
    const claimed = await prisma.game.updateMany({
      where: { id: gameId, startEmailSentAt: null, state: { not: "ENROLLING" } },
      data: { startEmailSentAt: new Date() },
    });
    if (claimed.count === 0) return;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, number: true, gameType: true },
    });
    if (!game) return;

    const players = await prisma.gamePlayer.findMany({
      where: { gameId, status: "ACTIVE" },
      select: {
        user: {
          select: {
            email: true,
            emailVerifiedAt: true,
            username: true,
          },
        },
      },
    });

    const label = GAME_LABELS[game.gameType] ?? game.gameType.replace(/_/g, " ");
    const gameUrl = `${siteBaseUrl()}/game/${game.id}`;

    for (const p of players) {
      const email = p.user.email?.trim().toLowerCase();
      if (!email || email.endsWith("@regaged.bot")) continue;
      // Prefer verified, but still notify if they have an email on file
      const subject = `Your ${label} game has started — Regaged`;
      const text = [
        `Hi ${p.user.username},`,
        ``,
        `Your ${label} game (#${game.number}) has started.`,
        `Open it here: ${gameUrl}`,
        ``,
        `— Regaged`,
      ].join("\n");
      const html = gameStartedHtml({
        username: p.user.username,
        gameLabel: label,
        gameNumber: game.number,
        gameUrl,
      });
      const result = await sendMail({ to: email, subject, text, html });
      if (!result.ok) {
        console.error("Game start email failed", { gameId, email, error: result.error });
      }
    }
  } catch (e) {
    console.error("notifyGameStarted failed", { gameId, err: String(e) });
  }
}
