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

// Gmail's own automatic dark-mode recoloring (especially the Android app)
// darkens bright inline background colors it judges "too light" even when
// meta color-scheme says light — it doesn't reliably honor that meta tag.
// When it recolors an element it tags it with data-ogsc/data-ogsb, which a
// <style> block CAN target to force the real color back. Verified live:
// our blue (#2596C7, medium luminance) survived untouched; our yellow
// (#FFD81A, very high luminance) got muddied to olive without this.
const emailDarkModeOverrides = `
  <style>
    .op-yellow-bg { background-color: ${BRAND_YELLOW} !important; }
    [data-ogsc] .op-yellow-bg, [data-ogsb] .op-yellow-bg { background-color: ${BRAND_YELLOW} !important; }
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
//
// The accent line uses a bulletproof table + bgcolor attribute, plus the
// op-yellow-bg class (see emailDarkModeOverrides above).
const emailHeader = `
  <div style="text-align: center; padding: 24px 0 16px;">
    <img src="${process.env.FRONTEND_URL}/logo-email.png?v=2" alt="Poule Position" width="180" style="display: block; margin: 0 auto; max-width: 180px; height: auto;" />
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
    <tr><td height="4" bgcolor="${BRAND_YELLOW}" class="op-yellow-bg" style="background-color: ${BRAND_YELLOW}; line-height: 4px; font-size: 4px;">&nbsp;</td></tr>
  </table>
`;

// Flat full-width color bar with bold uppercase text — the same blocky
// "signage" language as the site's homepage banners, adapted to what HTML
// email actually renders reliably (no CSS transforms/skew, most clients —
// Outlook included — only trust solid background colors on plain block
// elements). Yellow/black by default, matching the site's own primary CTA
// color (.btn-f1-primary); pass a url to make the whole bar a clickable link.
//
// Built as a table with a bgcolor attribute plus an op-*-bg class (see
// emailDarkModeOverrides above) for the same reason as the header line.
const emailBanner = (label: string, opts?: { url?: string; bg?: string; color?: string }) => {
  const bg = opts?.bg ?? BRAND_YELLOW;
  const color = opts?.color ?? '#000000';
  const bgClass = bg === BRAND_YELLOW ? 'op-yellow-bg' : bg === BRAND_BLUE ? 'op-blue-bg' : '';
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
        <td bgcolor="${bg}" class="${bgClass}" style="background-color: ${bg} !important; padding: 14px 24px;">
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

export const sendPredictionConfirmation = async (
  email: string,
  nickname: string,
  raceName: string,
  predictions: string[],
  dnfPickName?: string | null
) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Prediction Confirmed - ${raceName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${emailHeader}
        <h2 style="color: ${BRAND_NAVY};">Prediction Confirmed!</h2>
        <p>Hello ${escapeHtml(nickname)}!</p>
        <p>Your prediction for <strong>${escapeHtml(raceName)}</strong> has been saved:</p>
        <ol style="line-height: 2;">
          ${predictions.map((driver) => `<li>${escapeHtml(driver)}</li>`).join('')}
        </ol>
        ${dnfPickName ? `<p>First retirement pick: <strong>${escapeHtml(dnfPickName)}</strong> (+25 pts if correct)</p>` : ''}
        <p style="margin-top: 20px;">
          You can update your prediction until 1 minute before the race starts.
        </p>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Good luck! 🏎️
        </p>
      </div>
    `,
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
  actualPosition: number | null;
  pointsEarned: number;
  hasBonus: boolean;
}

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
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background-color: #333; color: white;">
            <th style="padding: 8px; text-align: left;">Predicted</th>
            <th style="padding: 8px; text-align: left;">Driver</th>
            <th style="padding: 8px; text-align: center;">Actual</th>
            <th style="padding: 8px; text-align: right;">Points</th>
          </tr>
          ${userPrediction.map((p, i) => `
            <tr style="background-color: ${p.hasBonus ? '#d4edda' : (i % 2 === 0 ? '#f9f9f9' : '#fff')};">
              <td style="padding: 8px;">P${p.predictedPosition}</td>
              <td style="padding: 8px;">${escapeHtml(p.driverName)}</td>
              <td style="padding: 8px; text-align: center;">${p.actualPosition ? `P${p.actualPosition}` : 'DNF/DNS'}</td>
              <td style="padding: 8px; text-align: right;">${p.pointsEarned}${p.hasBonus ? ' (½ pts)' : ''}</td>
            </tr>
          `).join('')}
        </table>

        <div style="background-color: ${BRAND_BLUE}; color: white; padding: 15px; border-radius: 5px; text-align: center;">
          <strong>Your Total Points: ${totalPoints}</strong>
        </div>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Note: These are provisional results. Final points will be calculated 24 hours after the race
          to account for any disqualifications or penalties.
        </p>
      </div>
    `,
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
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background-color: #333; color: white;">
          <th style="padding: 8px; text-align: left;">Predicted</th>
          <th style="padding: 8px; text-align: left;">Driver</th>
          <th style="padding: 8px; text-align: center;">Actual</th>
          <th style="padding: 8px; text-align: right;">Points</th>
        </tr>
        ${userPrediction.map((p, i) => `
          <tr style="background-color: ${p.hasBonus ? '#d4edda' : (i % 2 === 0 ? '#f9f9f9' : '#fff')};">
            <td style="padding: 8px;">P${p.predictedPosition}</td>
            <td style="padding: 8px;">${escapeHtml(p.driverName)}</td>
            <td style="padding: 8px; text-align: center;">${p.actualPosition ? `P${p.actualPosition}` : 'DNF/DNS'}</td>
            <td style="padding: 8px; text-align: right;">${p.pointsEarned}${p.hasBonus ? ' (½ pts)' : ''}</td>
          </tr>
        `).join('')}
      </table>
    `
    : '';

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Final Results - ${raceName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${emailHeader}
        <h2 style="color: ${BRAND_NAVY};">Final Race Results Confirmed</h2>
        <p>Hello ${escapeHtml(nickname)}!</p>
        <p>The final results for <strong>${escapeHtml(raceName)}</strong> have been confirmed.</p>

        ${changesSection}

        ${predictionTable}

        <div style="background-color: ${BRAND_BLUE}; color: white; padding: 15px; border-radius: 5px; text-align: center;">
          <strong>Your Final Points: ${totalPoints}</strong>
        </div>

        <p style="margin-top: 20px;">
          <a href="${process.env.FRONTEND_URL}/leaderboard"
             style="display: inline-block; background-color: ${BRAND_NAVY}; color: white;
                    padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            View Leaderboard
          </a>
        </p>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          See you at the next race! 🏎️
        </p>
      </div>
    `,
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
  const scoringPositions = isSprint ? 8 : 10;

  // Build a map: driverName -> actual position (for quick lookup)
  const actualPosByName = new Map<string, number>(actuals.map(a => [a.driverName, a.position]));

  const rows = predictions.map((pred) => {
    const actualPos = actualPosByName.get(pred.driverName);
    const diff = actualPos !== undefined ? Math.abs(pred.position - actualPos) : null;
    const isExact = diff === 0;
    const isNear = diff === 1;
    const rowBg = isExact ? '#d4edda' : isNear ? '#fff3cd' : '#ffffff';
    const statusText = diff === null
      ? 'Not scored'
      : isExact ? '✓ Exact'
      : isNear ? '≈ Near miss'
      : `Finished P${actualPos}`;

    const basePoints = pointsMap[pred.position] || 0;
    const inTopN = actualPos !== undefined && actualPos <= scoringPositions;
    const rowPoints = diff === 0 ? basePoints : (diff === 1 ? Math.round(basePoints * 0.5) : 0);
    const rowPointsText = rowPoints > 0 ? `+${rowPoints}` : '0';
    const rowPointsColor = rowPoints > basePoints ? '#155724' : rowPoints > 0 ? '#555' : '#aaa';

    return `
      <tr style="background-color:${rowBg};">
        <td style="padding:7px 10px;border-bottom:1px solid #eee;">P${pred.position}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:bold;">${escapeHtml(pred.driverName)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:center;">${actualPos != null ? `P${actualPos}` : '—'}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:center;font-size:12px;color:${isExact ? '#155724' : isNear ? '#856404' : '#555'};">${statusText}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:${rowPointsColor};">${rowPointsText}</td>
      </tr>`;
  }).join('');

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Your ${label} Predictions — ${raceName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        ${emailHeader}
        <h2 style="color:${accentColor};">Your ${escapeHtml(label)} Predictions</h2>
        <p>Hello ${escapeHtml(nickname)}!</p>
        <p>Here's how your prediction for <strong>${escapeHtml(raceName)}</strong> compared to the actual result:</p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
          <thead>
            <tr style="background-color:${accentColor};color:white;">
              <th style="padding:8px 10px;text-align:left;">Predicted</th>
              <th style="padding:8px 10px;text-align:left;">Driver</th>
              <th style="padding:8px 10px;text-align:center;">Actual Pos</th>
              <th style="padding:8px 10px;text-align:center;">Result</th>
              <th style="padding:8px 10px;text-align:right;">Pts</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div style="display:flex;gap:12px;margin-bottom:20px;font-size:12px;color:#555;">
          <span style="background:#d4edda;padding:3px 8px;border-radius:4px;">✓ Exact = correct position</span>
          <span style="background:#fff3cd;padding:3px 8px;border-radius:4px;">≈ Near miss = ±1 position (½ pts)</span>
        </div>

        <div style="background-color:${accentColor};color:white;padding:15px;border-radius:5px;text-align:center;margin-bottom:16px;">
          <strong>Points earned this race: ${pointsEarned}</strong>
        </div>

        <div style="background-color:#333;color:white;padding:12px;border-radius:5px;text-align:center;margin-bottom:24px;">
          Season total: <strong>${totalSeasonPoints}</strong> pts
        </div>

        <p>
          <a href="${process.env.FRONTEND_URL}/leaderboard"
             style="display:inline-block;background-color:#333;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;">
            View Leaderboard
          </a>
        </p>
        <p style="color:#666;font-size:12px;margin-top:30px;">See you at the next race! 🏎️</p>
      </div>
    `,
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
