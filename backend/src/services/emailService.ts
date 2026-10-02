import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// HTML escape function to prevent XSS in email templates
const escapeHtml = (text: string): string => {
  const htmlEscapes: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, char => htmlEscapes[char]);
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // false = STARTTLS on 587, true = implicit TLS on 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Brand colors — exact hex from the logo artwork (frontend/src/assets/poule-position-logo.svg)
const BRAND_NAVY = '#005277';
const BRAND_BLUE = '#2596C7';
const BRAND_YELLOW = '#FFD81A';

// Gmail's own automatic dark-mode recoloring (especially the Android app,
// via Android WebView's system-level "force dark") darkens bright inline
// background colors it judges "too light" — it does this by algorithmically
// adjusting computed CSS colors post-render, which meta color-scheme and
// data-ogsc/data-ogsb style overrides both failed to stop in a live test:
// our blue (#2596C7, medium luminance) survived, our yellow (#FFD81A, very
// high luminance) got muddied to olive regardless. Force-dark does NOT
// touch raster images though, so the fix for a high-luminance color like
// our brand yellow is a background IMAGE (emailYellowBg below) instead of a
// CSS color — bgcolor/background-color stay too, as the fallback for
// clients that block images.
const EMAIL_YELLOW_BG_URL = `${process.env.FRONTEND_URL}/email-yellow-bg.png`;

const emailDarkModeOverrides = `
  <style>
    .op-blue-bg { background-color: ${BRAND_BLUE} !important; }
    [data-ogsc] .op-blue-bg, [data-ogsb] .op-blue-bg { background-color: ${BRAND_BLUE} !important; }
    .op-black-text { color: #000000 !important; }
    [data-ogsc] .op-black-text, [data-ogsb] .op-black-text { color: #000000 !important; }
    .op-white-text { color: #ffffff !important; }
    [data-ogsc] .op-white-text, [data-ogsb] .op-white-text { color: #ffffff !important; }
  </style>
`;

// Logo header + thin yellow accent bar, reused at the top of every email.
// The image is hosted on the live site rather than embedded, since most mail
// clients strip data: URIs and inline SVG from HTML email.
//
// The ?v= query string is a deliberate cache-buster: Cloudflare edge-caches
// this asset (respecting its own Cache-Control) including response headers,
// so a bare-URL cache entry created before a header fix (e.g. the
// Cross-Origin-Resource-Policy change) keeps serving the stale headers on
// revalidation. Bump this whenever a header or the image itself changes.
const emailHeader = `
  <div style="text-align: center; padding: 24px 0 16px;">
    <img src="${process.env.FRONTEND_URL}/logo-email.png?v=2" alt="Poule Position" width="180" style="display: block; margin: 0 auto; max-width: 180px; height: auto;" />
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
    <tr>
      <td height="4" bgcolor="${BRAND_YELLOW}" background="${EMAIL_YELLOW_BG_URL}" style="background-color: ${BRAND_YELLOW}; background-image: url('${EMAIL_YELLOW_BG_URL}'); line-height: 4px; font-size: 4px;">&nbsp;</td>
    </tr>
  </table>
`;

// Flat full-width color bar with bold uppercase text — the same blocky
// "signage" language as the site's homepage banners, adapted to what HTML
// email actually renders reliably (no CSS transforms/skew, most clients —
// Outlook included — only trust solid background colors on plain block
// elements). Yellow/black by default, matching the site's own primary CTA
// color (.btn-f1-primary); pass a url to make the whole bar a clickable link.
//
// Yellow bars use the background-image trick (see EMAIL_YELLOW_BG_URL
// above) since force-dark otherwise darkens them; blue bars use the
// data-ogsc/data-ogsb class override, which was enough for blue alone.
const emailBanner = (label: string, opts?: { url?: string; bg?: string; color?: string }) => {
  const bg = opts?.bg ?? BRAND_YELLOW;
  const color = opts?.color ?? '#000000';
  const isYellow = bg === BRAND_YELLOW;
  const bgClass = isYellow ? '' : bg === BRAND_BLUE ? 'op-blue-bg' : '';
  const bgImageAttrs = isYellow
    ? `background="${EMAIL_YELLOW_BG_URL}" style="background-color: ${bg}; background-image: url('${EMAIL_YELLOW_BG_URL}'); padding: 14px 24px;"`
    : `style="background-color: ${bg} !important; padding: 14px 24px;"`;
  const textClass = color === '#000000' ? 'op-black-text' : color === '#ffffff' ? 'op-white-text' : '';
  const text = `
    <p class="${textClass}" style="margin: 0; color: ${color} !important; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; font-size: 18px;">
      ${escapeHtml(label)}
    </p>
  `;
  const content = opts?.url
    ? `<a href="${opts.url}" style="display: block; text-decoration: none;">${text}</a>`
    : text;

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
      <tr>
        <td bgcolor="${bg}" class="${bgClass}" ${bgImageAttrs}>
          ${content}
        </td>
      </tr>
    </table>
  `;
};

// Shared footer, with an optional one-click unsubscribe link for non-essential
// (announcement/broadcast) mail — transactional emails like prediction
// confirmations don't get this, since opting out of those would break the game.
const emailFooter = (unsubscribeUrl?: string) => `
  <p style="color: #666; font-size: 12px; margin-top: 30px;">
    Poule Position &middot; pouleposition.nl
    ${unsubscribeUrl ? `<br /><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe from announcement emails</a>` : ''}
  </p>
`;

// Full HTML document wrapper — the templates previously shipped as a bare
// <div>, with no <head> at all, so there was nowhere to declare color-scheme.
// Gmail (particularly the Android app) will auto-recolor an email it decides
// needs dark-mode treatment when the email doesn't say otherwise; declaring
// "light" here tells it this email is already themed and shouldn't be
// reinterpreted.
const emailDocument = (bodyHtml: string) => `
  <!DOCTYPE html>
  <html lang="en" style="margin: 0; padding: 0;">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="color-scheme" content="light" />
      <meta name="supported-color-schemes" content="light" />
      <title>Poule Position</title>
      ${emailDarkModeOverrides}
    </head>
    <body style="margin: 0; padding: 0; background-color: #ffffff;">
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${bodyHtml}
      </div>
    </body>
  </html>
`;

export interface PredictionPickForEmail {
  driverName: string;
  team?: string;
}

export const sendPredictionConfirmation = async (
  email: string,
  nickname: string,
  raceName: string,
  predictions: PredictionPickForEmail[],
  dnfPickName?: string | null
) => {
  const rows: UserPredictionResult[] = predictions.map((p, i) => ({
    predictedPosition: i + 1,
    driverName: p.driverName,
    team: p.team,
    actualPosition: undefined,
    pointsEarned: 0,
    hasBonus: false,
  }));

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Prediction Confirmed - ${raceName}`,
    html: emailDocument(`
      ${emailHeader}
      <h2 style="color: ${BRAND_NAVY};">Prediction Confirmed!</h2>
      <p>Hello ${escapeHtml(nickname)}!</p>
      <p>Your prediction for <strong>${escapeHtml(raceName)}</strong> has been saved:</p>
      ${emailPredictionRows(rows)}
      ${dnfPickName ? `<p>First retirement pick: <strong>${escapeHtml(dnfPickName)}</strong> (+25 pts if correct)</p>` : ''}
      <p style="margin-top: 20px;">
        You can update your prediction until 1 minute before the race starts.
      </p>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Good luck! 🏎️
      </p>
    `),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Prediction confirmation email sent to:', email);
  } catch (error) {
    console.error('Error sending prediction confirmation:', error);
  }
};

export interface RaceResultForEmail {
  position: number;
  driverName: string;
  points: number;
}

export interface UserPredictionResult {
  predictedPosition: number;
  driverName: string;
  team?: string;
  // undefined (not just null) means "not scored yet" — the confirmation
  // email lists picks before the race, with no actual/points column at all.
  actualPosition?: number | null;
  pointsEarned: number;
  hasBonus: boolean;
}

// The MyPredictions page's alternating blue/navy row list, ported to email —
// bulletproof table markup (bgcolor + style, same reasoning as the broadcast
// banners) since this is a stack of colored rows, not one bar. Blue/navy are
// both medium-to-low luminance, so unlike the broadcast yellow they don't
// need the background-image workaround — confirmed live during that fix.
const emailPredictionRows = (rows: UserPredictionResult[]) => {
  const hasResults = rows.some((r) => r.actualPosition !== undefined);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 16px 0;">
      ${rows
        .map((r, i) => {
          const bg = i % 2 === 0 ? BRAND_BLUE : BRAND_NAVY;
          const resultCell = hasResults
            ? `
              <td bgcolor="${bg}" align="right" style="background-color: ${bg}; padding: 10px 14px 10px 8px; white-space: nowrap; vertical-align: top;">
                <div style="color: rgba(255,255,255,0.8); font-size: 12px;">${r.actualPosition ? `&rarr; P${r.actualPosition}` : '&rarr; DNF'}</div>
                <div style="font-weight: 800; font-size: 14px; color: ${r.pointsEarned > 0 ? BRAND_YELLOW : 'rgba(255,255,255,0.6)'};">
                  ${r.pointsEarned > 0 ? `+${r.pointsEarned}${r.hasBonus ? ' &#9733;' : ''}` : '0'}
                </div>
              </td>
            `
            : '';
          return `
            <tr>
              <td bgcolor="${bg}" width="32" style="background-color: ${bg}; padding: 10px 0 10px 14px; color: rgba(255,255,255,0.8); font-weight: 800; font-size: 14px; vertical-align: top;">P${r.predictedPosition}</td>
              <td bgcolor="${bg}" style="background-color: ${bg}; padding: 10px 8px;">
                <div style="color: #ffffff; font-weight: 700; font-size: 14px;">${escapeHtml(r.driverName)}</div>
                ${r.team ? `<div style="color: rgba(255,255,255,0.7); font-size: 11px;">${escapeHtml(r.team)}</div>` : ''}
              </td>
              ${resultCell}
            </tr>
          `;
        })
        .join('')}
    </table>
  `;
};

export const sendProvisionalResults = async (
  email: string,
  nickname: string,
  raceName: string,
  raceResults: RaceResultForEmail[],
  userPrediction: UserPredictionResult[],
  totalPoints: number
) => {
  const top10Results = raceResults.slice(0, 10);

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Race Results - ${raceName} (Provisional)`,
    html: emailDocument(`
      ${emailHeader}
      <h2 style="color: ${BRAND_NAVY};">Provisional Race Results</h2>
      <p>Hello ${escapeHtml(nickname)}!</p>
      <p>The <strong>${escapeHtml(raceName)}</strong> has finished! Here are the provisional results:</p>

      <h3 style="color: #333; margin-top: 20px;">Race Results (Top 10)</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background-color: ${BRAND_NAVY}; color: white;">
          <th style="padding: 8px; text-align: left;">Pos</th>
          <th style="padding: 8px; text-align: left;">Driver</th>
          <th style="padding: 8px; text-align: right;">Points</th>
        </tr>
        ${top10Results.map((r, i) => `
          <tr style="background-color: ${i % 2 === 0 ? '#f9f9f9' : '#fff'};">
            <td style="padding: 8px;">${r.position}</td>
            <td style="padding: 8px;">${escapeHtml(r.driverName)}</td>
            <td style="padding: 8px; text-align: right;">${r.points}</td>
          </tr>
        `).join('')}
      </table>

      <h3 style="color: #333;">Your Prediction Results</h3>
      ${emailPredictionRows(userPrediction)}

      <div style="background-color: ${BRAND_BLUE}; color: white; padding: 15px; text-align: center;">
        <strong>Your Total Points: ${totalPoints}</strong>
      </div>

      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Note: These are provisional results. Final points will be calculated 24 hours after the race
        to account for any disqualifications or penalties.
      </p>
    `),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Provisional results email sent to:', email);
  } catch (error) {
    console.error('Error sending provisional results email:', error);
  }
};

export const sendFinalResults = async (
  email: string,
  nickname: string,
  raceName: string,
  totalPoints: number,
  hasChanges: boolean,
  previousPoints?: number,
  userPrediction?: UserPredictionResult[]
) => {
  const changesSection = hasChanges && previousPoints !== undefined
    ? `
      <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <strong>Results Updated!</strong><br>
        Due to post-race penalties/disqualifications, your points have changed:<br>
        Previous: ${previousPoints} points → Final: ${totalPoints} points
      </div>
    `
    : '';

  const predictionTable = userPrediction && userPrediction.length > 0
    ? `
      <h3 style="color: #333;">Your Prediction Results</h3>
      ${emailPredictionRows(userPrediction)}
    `
    : '';

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Final Results - ${raceName}`,
    html: emailDocument(`
      ${emailHeader}
      <h2 style="color: ${BRAND_NAVY};">Final Race Results Confirmed</h2>
      <p>Hello ${escapeHtml(nickname)}!</p>
      <p>The final results for <strong>${escapeHtml(raceName)}</strong> have been confirmed.</p>

      ${changesSection}

      ${predictionTable}

      <div style="background-color: ${BRAND_BLUE}; color: white; padding: 15px; text-align: center;">
        <strong>Your Final Points: ${totalPoints}</strong>
      </div>

      ${emailBanner('View Leaderboard', { url: `${process.env.FRONTEND_URL}/leaderboard`, bg: BRAND_NAVY, color: '#ffffff' })}

      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        See you at the next race! 🏎️
      </p>
    `),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Final results email sent to:', email);
  } catch (error) {
    console.error('Error sending final results email:', error);
  }
};

export const sendRaceReminder = async (
  email: string,
  nickname: string,
  raceName: string,
  raceDate: Date
) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Reminder: ${raceName} - Submit Your Prediction!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${emailHeader}
        <h2 style="color: ${BRAND_NAVY};">Race Day Reminder!</h2>
        <p>Hello ${escapeHtml(nickname)}!</p>
        <p><strong>${escapeHtml(raceName)}</strong> is coming up on ${raceDate.toLocaleDateString()}!</p>
        <p>Don't forget to submit your prediction before the race starts.</p>
        <a href="${process.env.FRONTEND_URL}"
           style="display: inline-block; background-color: ${BRAND_NAVY}; color: white;
                  padding: 12px 24px; text-decoration: none; border-radius: 5px;
                  margin: 20px 0;">
          Submit Prediction
        </a>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Good luck! 🏎️
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Race reminder email sent to:', email);
  } catch (error) {
    console.error('Error sending race reminder:', error);
  }
};

// Sent 1 hour before lights out to anyone who hasn't submitted a prediction
// yet for the upcoming race/sprint — last chance before it auto-locks and
// their previous prediction gets copied in instead.
export const sendMissedPredictionReminder = async (
  email: string,
  nickname: string,
  raceName: string,
  isSprint: boolean
) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `1 Hour Left — Submit Your Prediction for ${raceName}!`,
    html: emailDocument(`
      ${emailHeader}
      ${emailBanner('1 Hour To Lights Out', { bg: BRAND_YELLOW })}
      <h2 style="color: ${BRAND_NAVY};">Don't Miss Out!</h2>
      <p>Hello ${escapeHtml(nickname)}!</p>
      <p>
        You haven't submitted a ${isSprint ? 'sprint' : ''} prediction yet for
        <strong>${escapeHtml(raceName)}</strong>, and it locks in about 1 hour.
      </p>
      <p>
        If you don't submit in time, your last prediction will be copied in
        automatically — so get your own picks in while you still can!
      </p>
      ${emailBanner('Submit Prediction', { url: process.env.FRONTEND_URL!, bg: BRAND_NAVY, color: '#ffffff' })}
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Good luck! 🏎️
      </p>
    `),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Missed-prediction reminder email sent to:', email);
  } catch (error) {
    console.error('Error sending missed-prediction reminder:', error);
  }
};

// Password reset link. Transactional, so no unsubscribe link. Deliberately
// never logs the URL — it contains the reset token.
export const sendPasswordReset = async (email: string, nickname: string, resetUrl: string) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Reset your Poule Position password',
    html: emailDocument(`
      ${emailHeader}
      ${emailBanner('Reset Your Password', { url: resetUrl, bg: BRAND_NAVY, color: '#ffffff' })}
      <p>Hello ${escapeHtml(nickname)}!</p>
      <p>
        Someone asked to reset the password for your Poule Position account.
        Use the button above to choose a new one. The link works for 1 hour and
        only once.
      </p>
      <p style="color: #666; font-size: 12px; word-break: break-all;">
        Button not working? Paste this link into your browser:<br />
        <a href="${escapeHtml(resetUrl)}" style="color: #666;">${escapeHtml(resetUrl)}</a>
      </p>
      <p>If you didn't ask for this, you can ignore this email. Your password stays the same.</p>
      ${emailFooter()}
    `),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent to:', email);
  } catch (error) {
    console.error('Error sending password reset email:', error);
  }
};

// Sent right after copyMissingPredictions.ts auto-fills a no-show's prediction
// with their last race's picks, so they know it happened and what got entered
// on their behalf (rather than finding out silently from the results email).
export const sendAutoFillNotice = async (
  email: string,
  nickname: string,
  raceName: string,
  predictions: PredictionPickForEmail[]
) => {
  const rows: UserPredictionResult[] = predictions.map((p, i) => ({
    predictedPosition: i + 1,
    driverName: p.driverName,
    team: p.team,
    actualPosition: undefined,
    pointsEarned: 0,
    hasBonus: false,
  }));

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `We Filled In Your Prediction - ${raceName}`,
    html: emailDocument(`
      ${emailHeader}
      ${emailBanner('Prediction Auto-Filled', { bg: BRAND_YELLOW })}
      <h2 style="color: ${BRAND_NAVY};">You Didn't Predict In Time</h2>
      <p>Hello ${escapeHtml(nickname)}!</p>
      <p>
        <strong>${escapeHtml(raceName)}</strong> locked before you submitted a
        prediction, so we copied in your picks from your last race to keep you
        in the game:
      </p>
      ${emailPredictionRows(rows)}
      <p style="margin-top: 20px;">
        Nothing to do now — this prediction is locked in for this race. Don't
        forget to submit your own next time!
      </p>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Good luck! 🏎️
      </p>
    `),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Auto-fill notice email sent to:', email);
  } catch (error) {
    console.error('Error sending auto-fill notice:', error);
  }
};

// Send "The results are in!" email after final results are processed
export const sendResultsAreInEmail = async (
  email: string,
  nickname: string,
  raceName: string
) => {
  const leaderboardUrl = `${process.env.FRONTEND_URL}/leaderboard`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `The results are in! - ${raceName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${emailHeader}
        <h2 style="color: ${BRAND_NAVY};">The results are in!</h2>
        <p>Hello ${escapeHtml(nickname)}!</p>
        <p>The final results for <strong>${escapeHtml(raceName)}</strong> have been processed and the leaderboard has been updated.</p>
        <p>Check out where you stand!</p>
        <a href="${leaderboardUrl}"
           style="display: inline-block; background-color: ${BRAND_NAVY}; color: white;
                  padding: 12px 24px; text-decoration: none; border-radius: 5px;
                  margin: 20px 0;">
          View Leaderboard
        </a>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          See you at the next race! 🏎️
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Results-are-in email sent to:', email);
  } catch (error) {
    console.error('Error sending results-are-in email to', email, ':', error);
  }
};

export interface PersonalPredictionPosition {
  position: number;
  driverName: string;
  team?: string;
}

export const sendPersonalRaceResults = async (
  email: string,
  nickname: string,
  raceName: string,
  raceType: string,
  predictions: PersonalPredictionPosition[],
  actuals: PersonalPredictionPosition[],
  pointsEarned: number,
  totalSeasonPoints: number
): Promise<boolean> => {
  const isSprint = raceType === 'sprint';
  const accentColor = isSprint ? BRAND_BLUE : BRAND_NAVY;
  const label = isSprint ? 'Sprint Race' : 'Race';

  const mainPointsMap: { [key: number]: number } = { 1:25, 2:18, 3:15, 4:12, 5:10, 6:8, 7:6, 8:4, 9:2, 10:1 };
  const sprintPointsMap: { [key: number]: number } = { 1:8, 2:7, 3:6, 4:5, 5:4, 6:3, 7:2, 8:1 };
  const pointsMap = isSprint ? sprintPointsMap : mainPointsMap;

  // Build a map: driverName -> actual position (for quick lookup)
  const actualPosByName = new Map<string, number>(actuals.map(a => [a.driverName, a.position]));

  const predictionRows: UserPredictionResult[] = predictions.map((pred) => {
    const actualPos = actualPosByName.get(pred.driverName) ?? null;
    const diff = actualPos !== null ? Math.abs(pred.position - actualPos) : null;
    const basePoints = pointsMap[pred.position] || 0;
    const pointsEarnedForRow = diff === 0 ? basePoints : diff === 1 ? Math.round(basePoints * 0.5) : 0;

    return {
      predictedPosition: pred.position,
      driverName: pred.driverName,
      team: pred.team,
      actualPosition: actualPos,
      pointsEarned: pointsEarnedForRow,
      hasBonus: diff === 1,
    };
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Your ${label} Predictions — ${raceName}`,
    html: emailDocument(`
      ${emailHeader}
      <h2 style="color:${accentColor};">Your ${escapeHtml(label)} Predictions</h2>
      <p>Hello ${escapeHtml(nickname)}!</p>
      <p>Here's how your prediction for <strong>${escapeHtml(raceName)}</strong> compared to the actual result:</p>

      ${emailPredictionRows(predictionRows)}

      <p style="font-size:12px;color:#555;margin-bottom:20px;">A gold points value means an exact match; a ★ means a near miss (±1 position, half points).</p>

      <div style="background-color:${accentColor};color:white;padding:15px;text-align:center;margin-bottom:16px;">
        <strong>Points earned this race: ${pointsEarned}</strong>
      </div>

      <div style="background-color:#333;color:white;padding:12px;text-align:center;margin-bottom:24px;">
        Season total: <strong>${totalSeasonPoints}</strong> pts
      </div>

      ${emailBanner('View Leaderboard', { url: `${process.env.FRONTEND_URL}/leaderboard`, bg: BRAND_NAVY, color: '#ffffff' })}

      <p style="color:#666;font-size:12px;margin-top:30px;">See you at the next race! 🏎️</p>
    `),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Personal race results email sent to:', email);
    return true;
  } catch (error) {
    console.error('Error sending personal race results email to', email, ':', error);
    return false;
  }
};

// Send broadcast message to a user
export const sendBroadcastEmail = async (
  email: string,
  nickname: string,
  subject: string,
  message: string,
  unsubscribeUrl?: string
) => {
  // Convert newlines to <br> for HTML
  const htmlMessage = escapeHtml(message).replace(/\n/g, '<br>');

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Poule Position - ${subject}`,
    html: emailDocument(`
      ${emailHeader}
      ${emailBanner(subject, { bg: BRAND_BLUE, color: '#ffffff' })}
      <p>Hello ${escapeHtml(nickname)}!</p>
      <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0;">
        ${htmlMessage}
      </div>
      ${emailBanner('Visit Poule Position', { url: process.env.FRONTEND_URL! })}
      ${emailFooter(unsubscribeUrl)}
    `),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Broadcast email sent to:', email);
    return true;
  } catch (error) {
    console.error('Error sending broadcast email to', email, ':', error);
    return false;
  }
};

// Sent to the admin when an idea from a player is approved for the Pit Wall.
// Everything in it is player-written text, so it is escaped everywhere and
// kept out of the subject line's control characters.
export const sendPitwallApproved = async (idea: {
  nickname: string;
  kind: string;
  title: string;
  description: string;
  adminNote?: string | null;
}): Promise<boolean> => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error('ADMIN_EMAIL not configured — cannot send Pit Wall approval');
    return false;
  }

  const oneLine = (text: string) => text.replace(/[\r\n]+/g, ' ').trim();
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: adminEmail,
    subject: `Pit Wall: approved ${oneLine(idea.kind)} from ${oneLine(idea.nickname)}`.slice(0, 200),
    html: emailDocument(`
      ${emailHeader}
      ${emailBanner('Approved For The Pit Wall', { bg: BRAND_BLUE, color: '#ffffff' })}
      <p><strong>${escapeHtml(idea.nickname)}</strong> suggested an <strong>${escapeHtml(idea.kind)}</strong> and you approved it:</p>
      <h2 style="color: ${BRAND_NAVY}; margin-bottom: 8px;">${escapeHtml(idea.title)}</h2>
      ${idea.description ? `<p style="white-space: pre-wrap;">${escapeHtml(idea.description)}</p>` : ''}
      ${idea.adminNote ? `<p style="color: #666;"><em>Your note: ${escapeHtml(idea.adminNote)}</em></p>` : ''}
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        It is marked approved in the Pitlane. Add it to the definitive Pit Wall when you are ready.
      </p>
      ${emailFooter()}
    `),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Pit Wall approval email sent');
    return true;
  } catch (error) {
    console.error('Error sending Pit Wall approval email:', error);
    return false;
  }
};

// Sent to the admin the moment a player submits something on the Pit Wall, so
// new ideas don't sit unseen until someone opens the Pitlane. Player-written
// text throughout, so it is escaped and kept out of the subject's control characters.
export const sendPitwallSubmitted = async (idea: {
  nickname: string;
  kind: string;
  title: string;
  description: string;
}): Promise<boolean> => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error('ADMIN_EMAIL not configured — cannot send Pit Wall submission notice');
    return false;
  }

  const oneLine = (text: string) => text.replace(/[\r\n]+/g, ' ').trim();
  const pitlaneUrl = `${process.env.FRONTEND_URL}/pitlane`;
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: adminEmail,
    subject: `Pit Wall: new ${oneLine(idea.kind)} from ${oneLine(idea.nickname)}`.slice(0, 200),
    html: emailDocument(`
      ${emailHeader}
      ${emailBanner('New Pit Wall Suggestion', { url: pitlaneUrl, bg: BRAND_BLUE, color: '#ffffff' })}
      <p><strong>${escapeHtml(idea.nickname)}</strong> submitted an <strong>${escapeHtml(idea.kind)}</strong>:</p>
      <h2 style="color: ${BRAND_NAVY}; margin-bottom: 8px;">${escapeHtml(idea.title)}</h2>
      ${idea.description ? `<p style="white-space: pre-wrap;">${escapeHtml(idea.description)}</p>` : ''}
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        It is waiting for your decision in the Pitlane (Pit Wall Ideas).
      </p>
      ${emailFooter()}
    `),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Pit Wall submission notice sent');
    return true;
  } catch (error) {
    console.error('Error sending Pit Wall submission notice:', error);
    return false;
  }
};

// Internal ops alert — e.g. results still unavailable from the API after the retry window
export const sendAdminAlert = async (subject: string, message: string): Promise<boolean> => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error('ADMIN_EMAIL not configured — cannot send admin alert:', subject);
    return false;
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: adminEmail,
    subject: `[Poule Position Alert] ${subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${emailHeader}
        <h2 style="color: ${BRAND_NAVY};">Ops Alert</h2>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Admin alert sent:', subject);
    return true;
  } catch (error) {
    console.error('Error sending admin alert:', error);
    return false;
  }
};
