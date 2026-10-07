import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { EmailLang, normalizeLang, et } from './emailI18n';

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

// Bold, HTML-safe snippet to drop into a translated sentence's {placeholder}.
const bold = (text: string): string => `<strong>${escapeHtml(text)}</strong>`;

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

// Default sign-off for every email that goes to a player: two empty lines
// under the message, "Kimi", one more empty line, then the small logo with
// the site address. Empty lines are non-breaking-space paragraphs because mail
// clients collapse truly empty elements. The logo is the hosted PNG (see
// emailHeader) at signature size, and links to the site along with the address.
const SIGNATURE_URL = 'https://www.pouleposition.nl';
const emailSignature = () => `
  <div style="margin-top: 8px; font-size: 14px; color: #222222;">
    <p style="margin: 0; line-height: 1.5;">&nbsp;</p>
    <p style="margin: 0; line-height: 1.5;">&nbsp;</p>
    <p style="margin: 0; line-height: 1.5;">Kimi.</p>
    <p style="margin: 0; line-height: 1.5;">&nbsp;</p>
    <a href="${SIGNATURE_URL}" style="text-decoration: none;">
      <img src="${process.env.FRONTEND_URL}/logo-email.png?v=2" alt="Poule Position" width="56" style="display: block; width: 56px; max-width: 56px; height: auto; border: 0;" />
    </a>
    <p style="margin: 4px 0 0; line-height: 1.5;">
      <a href="${SIGNATURE_URL}" style="color: ${BRAND_NAVY}; text-decoration: none;">www.pouleposition.nl</a>
    </p>
  </div>
`;

// Footer line below the signature. Only announcement/broadcast mail gets one:
// a one-click unsubscribe link. Transactional emails (prediction confirmations,
// password reset) have none, since opting out of those would break the game.
const emailFooter = (unsubscribeUrl?: string, lang: EmailLang = 'en') =>
  unsubscribeUrl
    ? `
  <p style="color: #666; font-size: 12px; margin-top: 30px;">
    <a href="${unsubscribeUrl}" style="color: #999;">${et(lang, 'common.unsubscribe')}</a>
  </p>
`
    : '';

// Full HTML document wrapper — the templates previously shipped as a bare
// <div>, with no <head> at all, so there was nowhere to declare color-scheme.
// Gmail (particularly the Android app) will auto-recolor an email it decides
// needs dark-mode treatment when the email doesn't say otherwise; declaring
// "light" here tells it this email is already themed and shouldn't be
// reinterpreted.
// Pass signature: false for mails that go to the admin rather than a player,
// and footer for anything that belongs below the signature.
const emailDocument = (
  bodyHtml: string,
  lang: EmailLang = 'en',
  opts: { signature?: boolean; footer?: string } = {}
) => `
  <!DOCTYPE html>
  <html lang="${lang}" style="margin: 0; padding: 0;">
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
        ${opts.signature === false ? '' : emailSignature()}
        ${opts.footer ?? ''}
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
  dnfPickName?: string | null,
  language?: string | null
) => {
  const lang = normalizeLang(language);
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
    subject: et(lang, 'predConfirm.subject', { race: raceName }),
    html: emailDocument(`
      ${emailHeader}
      <h2 style="color: ${BRAND_NAVY};">${et(lang, 'predConfirm.title')}</h2>
      <p>${et(lang, 'common.hello', { name: escapeHtml(nickname) })}</p>
      <p>${et(lang, 'predConfirm.intro', { race: bold(raceName) })}</p>
      ${emailPredictionRows(rows, lang)}
      ${dnfPickName ? `<p>${et(lang, 'predConfirm.dnf', { name: bold(dnfPickName) })}</p>` : ''}
      <p style="margin-top: 20px;">
        ${et(lang, 'predConfirm.update')}
      </p>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        ${et(lang, 'common.goodLuck')}
      </p>
    `, lang),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Prediction confirmation email sent to:', email, `[${lang}]`);
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
const emailPredictionRows = (rows: UserPredictionResult[], lang: EmailLang = 'en') => {
  const hasResults = rows.some((r) => r.actualPosition !== undefined);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 16px 0;">
      ${rows
        .map((r, i) => {
          const bg = i % 2 === 0 ? BRAND_BLUE : BRAND_NAVY;
          const resultCell = hasResults
            ? `
              <td bgcolor="${bg}" align="right" style="background-color: ${bg}; padding: 10px 14px 10px 8px; white-space: nowrap; vertical-align: top;">
                <div style="color: rgba(255,255,255,0.8); font-size: 12px;">${r.actualPosition ? `&rarr; P${r.actualPosition}` : `&rarr; ${et(lang, 'common.dnf')}`}</div>
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
  totalPoints: number,
  language?: string | null
) => {
  const lang = normalizeLang(language);
  const top10Results = raceResults.slice(0, 10);

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: et(lang, 'provisional.subject', { race: raceName }),
    html: emailDocument(`
      ${emailHeader}
      <h2 style="color: ${BRAND_NAVY};">${et(lang, 'provisional.title')}</h2>
      <p>${et(lang, 'common.hello', { name: escapeHtml(nickname) })}</p>
      <p>${et(lang, 'provisional.intro', { race: bold(raceName) })}</p>

      <h3 style="color: #333; margin-top: 20px;">${et(lang, 'provisional.top10')}</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background-color: ${BRAND_NAVY}; color: white;">
          <th style="padding: 8px; text-align: left;">${et(lang, 'provisional.pos')}</th>
          <th style="padding: 8px; text-align: left;">${et(lang, 'provisional.driver')}</th>
          <th style="padding: 8px; text-align: right;">${et(lang, 'provisional.points')}</th>
        </tr>
        ${top10Results.map((r, i) => `
          <tr style="background-color: ${i % 2 === 0 ? '#f9f9f9' : '#fff'};">
            <td style="padding: 8px;">${r.position}</td>
            <td style="padding: 8px;">${escapeHtml(r.driverName)}</td>
            <td style="padding: 8px; text-align: right;">${r.points}</td>
          </tr>
        `).join('')}
      </table>

      <h3 style="color: #333;">${et(lang, 'provisional.yourResults')}</h3>
      ${emailPredictionRows(userPrediction, lang)}

      <div style="background-color: ${BRAND_BLUE}; color: white; padding: 15px; text-align: center;">
        <strong>${et(lang, 'provisional.total', { points: totalPoints })}</strong>
      </div>

      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        ${et(lang, 'provisional.note')}
      </p>
    `, lang),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Provisional results email sent to:', email, `[${lang}]`);
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
  userPrediction?: UserPredictionResult[],
  language?: string | null
) => {
  const lang = normalizeLang(language);
  const changesSection = hasChanges && previousPoints !== undefined
    ? `
      <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <strong>${et(lang, 'final.updatedTitle')}</strong><br>
        ${et(lang, 'final.updatedText')}<br>
        ${et(lang, 'final.updatedChange', { previous: previousPoints, final: totalPoints })}
      </div>
    `
    : '';

  const predictionTable = userPrediction && userPrediction.length > 0
    ? `
      <h3 style="color: #333;">${et(lang, 'final.yourResults')}</h3>
      ${emailPredictionRows(userPrediction, lang)}
    `
    : '';

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: et(lang, 'final.subject', { race: raceName }),
    html: emailDocument(`
      ${emailHeader}
      <h2 style="color: ${BRAND_NAVY};">${et(lang, 'final.title')}</h2>
      <p>${et(lang, 'common.hello', { name: escapeHtml(nickname) })}</p>
      <p>${et(lang, 'final.intro', { race: bold(raceName) })}</p>

      ${changesSection}

      ${predictionTable}

      <div style="background-color: ${BRAND_BLUE}; color: white; padding: 15px; text-align: center;">
        <strong>${et(lang, 'final.total', { points: totalPoints })}</strong>
      </div>

      ${emailBanner(et(lang, 'common.viewLeaderboard'), { url: `${process.env.FRONTEND_URL}/leaderboard`, bg: BRAND_NAVY, color: '#ffffff' })}

      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        ${et(lang, 'common.seeYou')}
      </p>
    `, lang),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Final results email sent to:', email, `[${lang}]`);
  } catch (error) {
    console.error('Error sending final results email:', error);
  }
};

export const sendRaceReminder = async (
  email: string,
  nickname: string,
  raceName: string,
  raceDate: Date,
  language?: string | null
) => {
  const lang = normalizeLang(language);
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: et(lang, 'raceReminder.subject', { race: raceName }),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${emailHeader}
        <h2 style="color: ${BRAND_NAVY};">${et(lang, 'raceReminder.title')}</h2>
        <p>${et(lang, 'common.hello', { name: escapeHtml(nickname) })}</p>
        <p>${et(lang, 'raceReminder.text', { race: bold(raceName), date: lang === 'nl' ? raceDate.toLocaleDateString('nl-NL') : raceDate.toLocaleDateString() })}</p>
        <p>${et(lang, 'raceReminder.dont')}</p>
        <a href="${process.env.FRONTEND_URL}"
           style="display: inline-block; background-color: ${BRAND_NAVY}; color: white;
                  padding: 12px 24px; text-decoration: none; border-radius: 5px;
                  margin: 20px 0;">
          ${et(lang, 'common.submitPrediction')}
        </a>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          ${et(lang, 'common.goodLuck')}
        </p>
        ${emailSignature()}
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Race reminder email sent to:', email, `[${lang}]`);
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
  isSprint: boolean,
  language?: string | null
) => {
  const lang = normalizeLang(language);
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: et(lang, 'missed.subject', { race: raceName }),
    html: emailDocument(`
      ${emailHeader}
      ${emailBanner(et(lang, 'missed.banner'), { bg: BRAND_YELLOW })}
      <h2 style="color: ${BRAND_NAVY};">${et(lang, 'missed.title')}</h2>
      <p>${et(lang, 'common.hello', { name: escapeHtml(nickname) })}</p>
      <p>
        ${et(lang, isSprint ? 'missed.bodySprint' : 'missed.bodyRace', { race: bold(raceName) })}
      </p>
      <p>
        ${et(lang, 'missed.fallback')}
      </p>
      ${emailBanner(et(lang, 'common.submitPrediction'), { url: process.env.FRONTEND_URL!, bg: BRAND_NAVY, color: '#ffffff' })}
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        ${et(lang, 'common.goodLuck')}
      </p>
    `, lang),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Missed-prediction reminder email sent to:', email, `[${lang}]`);
  } catch (error) {
    console.error('Error sending missed-prediction reminder:', error);
  }
};

// Password reset link. Transactional, so no unsubscribe link. Deliberately
// never logs the URL — it contains the reset token.
export const sendPasswordReset = async (email: string, nickname: string, resetUrl: string, language?: string | null) => {
  const lang = normalizeLang(language);
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: et(lang, 'reset.subject'),
    html: emailDocument(`
      ${emailHeader}
      ${emailBanner(et(lang, 'reset.banner'), { url: resetUrl, bg: BRAND_NAVY, color: '#ffffff' })}
      <p>${et(lang, 'common.hello', { name: escapeHtml(nickname) })}</p>
      <p>
        ${et(lang, 'reset.intro')}
      </p>
      <p style="color: #666; font-size: 12px; word-break: break-all;">
        ${et(lang, 'reset.fallback')}<br />
        <a href="${escapeHtml(resetUrl)}" style="color: #666;">${escapeHtml(resetUrl)}</a>
      </p>
      <p>${et(lang, 'reset.ignore')}</p>
    `, lang),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent to:', email, `[${lang}]`);
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
  predictions: PredictionPickForEmail[],
  language?: string | null
) => {
  const lang = normalizeLang(language);
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
    subject: et(lang, 'autofill.subject', { race: raceName }),
    html: emailDocument(`
      ${emailHeader}
      ${emailBanner(et(lang, 'autofill.banner'), { bg: BRAND_YELLOW })}
      <h2 style="color: ${BRAND_NAVY};">${et(lang, 'autofill.title')}</h2>
      <p>${et(lang, 'common.hello', { name: escapeHtml(nickname) })}</p>
      <p>
        ${et(lang, 'autofill.intro', { race: bold(raceName) })}
      </p>
      ${emailPredictionRows(rows, lang)}
      <p style="margin-top: 20px;">
        ${et(lang, 'autofill.nothing')}
      </p>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        ${et(lang, 'common.goodLuck')}
      </p>
    `, lang),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Auto-fill notice email sent to:', email, `[${lang}]`);
  } catch (error) {
    console.error('Error sending auto-fill notice:', error);
  }
};

// Send "The results are in!" email after final results are processed
export const sendResultsAreInEmail = async (
  email: string,
  nickname: string,
  raceName: string,
  language?: string | null
) => {
  const lang = normalizeLang(language);
  const leaderboardUrl = `${process.env.FRONTEND_URL}/leaderboard`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: et(lang, 'resultsIn.subject', { race: raceName }),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${emailHeader}
        <h2 style="color: ${BRAND_NAVY};">${et(lang, 'resultsIn.title')}</h2>
        <p>${et(lang, 'common.hello', { name: escapeHtml(nickname) })}</p>
        <p>${et(lang, 'resultsIn.text', { race: bold(raceName) })}</p>
        <p>${et(lang, 'resultsIn.check')}</p>
        <a href="${leaderboardUrl}"
           style="display: inline-block; background-color: ${BRAND_NAVY}; color: white;
                  padding: 12px 24px; text-decoration: none; border-radius: 5px;
                  margin: 20px 0;">
          ${et(lang, 'common.viewLeaderboard')}
        </a>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          ${et(lang, 'common.seeYou')}
        </p>
        ${emailSignature()}
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Results-are-in email sent to:', email, `[${lang}]`);
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
  totalSeasonPoints: number,
  language?: string | null
): Promise<boolean> => {
  const lang = normalizeLang(language);
  const isSprint = raceType === 'sprint';
  const accentColor = isSprint ? BRAND_BLUE : BRAND_NAVY;

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
    subject: et(lang, isSprint ? 'personal.subjectSprint' : 'personal.subjectRace', { race: raceName }),
    html: emailDocument(`
      ${emailHeader}
      <h2 style="color:${accentColor};">${et(lang, isSprint ? 'personal.titleSprint' : 'personal.titleRace')}</h2>
      <p>${et(lang, 'common.hello', { name: escapeHtml(nickname) })}</p>
      <p>${et(lang, 'personal.intro', { race: bold(raceName) })}</p>

      ${emailPredictionRows(predictionRows, lang)}

      <p style="font-size:12px;color:#555;margin-bottom:20px;">${et(lang, 'personal.legend')}</p>

      <div style="background-color:${accentColor};color:white;padding:15px;text-align:center;margin-bottom:16px;">
        <strong>${et(lang, 'personal.earned', { points: pointsEarned })}</strong>
      </div>

      <div style="background-color:#333;color:white;padding:12px;text-align:center;margin-bottom:24px;">
        ${et(lang, 'personal.season', { points: `<strong>${totalSeasonPoints}</strong>` })}
      </div>

      ${emailBanner(et(lang, 'common.viewLeaderboard'), { url: `${process.env.FRONTEND_URL}/leaderboard`, bg: BRAND_NAVY, color: '#ffffff' })}

      <p style="color:#666;font-size:12px;margin-top:30px;">${et(lang, 'common.seeYou')}</p>
    `, lang),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Personal race results email sent to:', email, `[${lang}]`);
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
  unsubscribeUrl?: string,
  language?: string | null
) => {
  const lang = normalizeLang(language);
  // Convert newlines to <br> for HTML
  const htmlMessage = escapeHtml(message).replace(/\n/g, '<br>');

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: et(lang, 'broadcast.subject', { subject }),
    html: emailDocument(`
      ${emailHeader}
      ${emailBanner(subject, { bg: BRAND_BLUE, color: '#ffffff' })}
      <p>${et(lang, 'common.hello', { name: escapeHtml(nickname) })}</p>
      <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0;">
        ${htmlMessage}
      </div>
      ${emailBanner(et(lang, 'common.visit'), { url: process.env.FRONTEND_URL! })}
    `, lang, { footer: emailFooter(unsubscribeUrl, lang) }),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Broadcast email sent to:', email, `[${lang}]`);
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
    `, 'en', { signature: false }),
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
    `, 'en', { signature: false }),
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

// Sent to the admin when someone signs up or deletes their own account.
// Nickname and email are player-written, so everything is escaped and kept out
// of the subject's control characters.
export interface MemberNoticeDetails {
  kind: 'joined' | 'left';
  nickname: string;
  email: string;
  language?: string | null;
  totalMembers: number;
  // Only known for someone who is leaving
  memberSince?: Date | string | null;
  totalPoints?: number | null;
  predictionCount?: number | null;
}

export const sendMemberNotice = async (member: MemberNoticeDetails): Promise<boolean> => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error('ADMIN_EMAIL not configured — cannot send member notice');
    return false;
  }

  const joined = member.kind === 'joined';
  const oneLine = (text: string) => text.replace(/[\r\n]+/g, ' ').trim();
  const formatNL = (value: Date | string) =>
    new Date(value).toLocaleString('nl-NL', {
      timeZone: 'Europe/Amsterdam',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const rows: Array<[string, string]> = [
    ['Nickname', escapeHtml(member.nickname)],
    ['Email', escapeHtml(member.email)],
    ['Language', member.language === 'nl' ? 'Dutch' : member.language === 'en' ? 'English' : 'Not set'],
  ];
  if (!joined) {
    if (member.memberSince) rows.push(['Member since', formatNL(member.memberSince)]);
    if (member.predictionCount != null) rows.push(['Predictions made', String(member.predictionCount)]);
    if (member.totalPoints != null) rows.push(['Points', String(member.totalPoints)]);
  }
  rows.push([joined ? 'Signed up' : 'Left', formatNL(new Date())]);
  rows.push(['Members now', String(member.totalMembers)]);

  const tableRows = rows
    .map(
      ([label, value], i) => `
        <tr>
          <td style="padding: 10px 14px; background-color: ${i % 2 === 0 ? BRAND_BLUE : BRAND_NAVY}; color: #ffffff; font-weight: 700; width: 38%;">${label}</td>
          <td style="padding: 10px 14px; background-color: ${i % 2 === 0 ? BRAND_BLUE : BRAND_NAVY}; color: #ffffff;">${value}</td>
        </tr>`
    )
    .join('');

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: adminEmail,
    subject: `Poule Position: ${joined ? 'new member' : 'member left'} — ${oneLine(member.nickname)}`.slice(0, 200),
    html: emailDocument(
      `
      ${emailHeader}
      ${emailBanner(joined ? 'New Member' : 'Member Left', { bg: joined ? BRAND_YELLOW : BRAND_NAVY, color: joined ? '#000000' : '#ffffff' })}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px; margin-bottom: 24px;">
        ${tableRows}
      </table>
      <p style="color: #666; font-size: 12px;">
        ${joined ? 'They have received no email from the site yet.' : 'Their account, predictions and points have been deleted.'}
      </p>
    `,
      'en',
      { signature: false }
    ),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Member notice sent (${member.kind})`);
    return true;
  } catch (error) {
    console.error('Error sending member notice:', error);
    return false;
  }
};

// Sent to the admin when the results cross-check needs a human: sources
// disagree (results held back), or results were applied on thin evidence.
// Only driver names, race names and our own wording go in — all escaped anyway.
export interface ResultsCheckAlertDetails {
  raceName: string;
  isSprint: boolean;
  season: number;
  mode: 'provisional' | 'final' | 'manual';
  action: 'apply' | 'wait' | 'hold';
  reason: string;
  warning: string | null;
  scored: number;
  driverNames: Record<number, string>;
  sources: Array<{ label: string; available: boolean; note?: string; top: number[]; firstOut: number | null }>;
  differences: Array<{ label: string; what: string }>;
}

export const sendResultsCheckAlert = async (d: ResultsCheckAlertDetails): Promise<boolean> => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error('ADMIN_EMAIL not configured — cannot send results check alert');
    return false;
  }

  const held = d.action === 'hold';
  const nameOf = (n: number | undefined) => (n == null ? '–' : escapeHtml((d.driverNames[n] || `#${n}`).split(' ').slice(-1)[0]));
  const used = d.sources.filter((s) => s.available);

  const header = `<tr>${['Pos', ...d.sources.map((s) => s.label)]
    .map((h) => `<td style="padding: 8px 10px; background-color: ${BRAND_YELLOW}; color: #000000; font-weight: 800; font-size: 12px; text-transform: uppercase;">${escapeHtml(h)}</td>`)
    .join('')}</tr>`;

  const bodyRows: string[] = [];
  for (let i = 0; i < d.scored; i++) {
    const values = used.map((s) => s.top[i]);
    const counts = new Map<number | undefined, number>();
    values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
    const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const bg = i % 2 === 0 ? BRAND_BLUE : BRAND_NAVY;
    const cells = d.sources.map((s) => {
      const value = s.available ? s.top[i] : undefined;
      const differs = s.available && used.length > 1 && value !== common;
      const style = differs ? `background-color: ${BRAND_YELLOW}; color: #000000; font-weight: 800;` : `background-color: ${bg}; color: #ffffff;`;
      return `<td style="padding: 8px 10px; ${style}">${s.available ? nameOf(value) : '–'}</td>`;
    });
    bodyRows.push(`<tr><td style="padding: 8px 10px; background-color: ${bg}; color: #ffffff; font-weight: 700;">${i + 1}</td>${cells.join('')}</tr>`);
  }

  if (!d.isSprint) {
    const bg = d.scored % 2 === 0 ? BRAND_BLUE : BRAND_NAVY;
    const outs = used.map((s) => s.firstOut);
    const counts = new Map<number | null, number>();
    outs.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
    const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const cells = d.sources.map((s) => {
      const differs = s.available && used.length > 1 && s.firstOut !== common;
      const style = differs ? `background-color: ${BRAND_YELLOW}; color: #000000; font-weight: 800;` : `background-color: ${bg}; color: #ffffff;`;
      return `<td style="padding: 8px 10px; ${style}">${s.available ? (s.firstOut ? nameOf(s.firstOut) : 'none') : '–'}</td>`;
    });
    bodyRows.push(`<tr><td style="padding: 8px 10px; background-color: ${bg}; color: #ffffff; font-weight: 700;">1st out</td>${cells.join('')}</tr>`);
  }

  const notes = d.sources.filter((s) => !s.available && s.note).map((s) => `<li>${escapeHtml(s.label)}: ${escapeHtml(s.note!)}</li>`).join('');
  const diffs = d.differences.map((x) => `<li><strong>${escapeHtml(x.label)}</strong>: ${escapeHtml(x.what)}</li>`).join('');
  const pitlaneUrl = `${process.env.FRONTEND_URL}/pitlane`;

  const headline = held ? 'Results On Hold' : 'Results Applied — Please Check';
  const intro = held
    ? 'The sources disagree about this result, so nothing was changed and no points were calculated or emailed. Check the table below, then decide in the Pitlane (Force Re-sync applies the first source in priority order: Jolpi, OpenF1, then the F1 live feed).'
    : escapeHtml(d.warning || d.reason);

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: adminEmail,
    subject: `[Poule Position] ${held ? 'Results on hold' : 'Check results'} — ${d.raceName.replace(/[\r\n]+/g, ' ')}${d.isSprint ? ' (sprint)' : ''}`.slice(0, 200),
    html: emailDocument(
      `
      ${emailHeader}
      ${emailBanner(headline, { url: pitlaneUrl, bg: held ? BRAND_YELLOW : BRAND_NAVY, color: held ? '#000000' : '#ffffff' })}
      <h2 style="color: ${BRAND_NAVY}; margin-bottom: 4px;">${escapeHtml(d.raceName)}${d.isSprint ? ' (Sprint)' : ''}</h2>
      <p style="margin-top: 0;">${intro}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; margin: 16px 0;">
        ${header}
        ${bodyRows.join('')}
      </table>
      ${diffs ? `<p style="margin-bottom: 4px;"><strong>Where they differ</strong></p><ul style="margin-top: 0;">${diffs}</ul>` : ''}
      ${notes ? `<p style="margin-bottom: 4px;"><strong>Sources without data</strong></p><ul style="margin-top: 0;">${notes}</ul>` : ''}
      <p style="color: #666; font-size: 12px;">Yellow cells differ from what the other sources show. Context: ${escapeHtml(d.mode)} check — ${escapeHtml(d.reason)}.</p>
    `,
      'en',
      { signature: false }
    ),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Results check alert sent:', d.raceName);
    return true;
  } catch (error) {
    console.error('Error sending results check alert:', error);
    return false;
  }
};

// Sent right after someone registers: what the game is, how a weekend works and
// the scoring in a few lines (kept in step with the Rules page). Transactional,
// so no unsubscribe link. Replies go to the sender address (kimi@).
export const sendWelcomeEmail = async (email: string, nickname: string, language?: string | null): Promise<boolean> => {
  const lang = normalizeLang(language);
  const appUrl = process.env.FRONTEND_URL!;
  const heading = (text: string) =>
    `<h3 style="color: ${BRAND_NAVY}; margin: 24px 0 8px; font-size: 18px;">${text}</h3>`;
  const list = (items: string[]) =>
    `<ul style="margin: 0 0 8px; padding-left: 20px; line-height: 1.5;">${items.map((i) => `<li style="margin-bottom: 6px;">${i}</li>`).join('')}</ul>`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: et(lang, 'welcome.subject', { name: nickname.replace(/[\r\n]+/g, ' ').trim() }).slice(0, 200),
    html: emailDocument(
      `
      ${emailHeader}
      ${emailBanner(et(lang, 'welcome.banner'), { bg: BRAND_YELLOW })}
      <p>${et(lang, 'common.hello', { name: escapeHtml(nickname) })}</p>
      <p style="line-height: 1.5;">${et(lang, 'welcome.intro')}</p>

      ${heading(et(lang, 'welcome.how.title'))}
      ${list([et(lang, 'welcome.how.1'), et(lang, 'welcome.how.2'), et(lang, 'welcome.how.3')])}

      ${heading(et(lang, 'welcome.scoring.title'))}
      ${list([
        et(lang, 'welcome.scoring.exact'),
        et(lang, 'welcome.scoring.near'),
        et(lang, 'welcome.scoring.miss'),
        et(lang, 'welcome.scoring.dnf'),
        et(lang, 'welcome.scoring.sprint'),
      ])}

      <p style="line-height: 1.5; margin-top: 16px;">${et(lang, 'welcome.forgot')}</p>
      <p style="line-height: 1.5;">${et(lang, 'welcome.profile')}</p>

      <div style="margin-top: 24px;">
        ${emailBanner(et(lang, 'welcome.cta'), { url: appUrl, bg: BRAND_NAVY, color: '#ffffff' })}
      </div>
      <p style="line-height: 1.5;">${et(lang, 'welcome.rules')} <a href="${appUrl}/rules" style="color: ${BRAND_NAVY};">${et(lang, 'welcome.rulesLink')}</a></p>
      <p style="line-height: 1.5;">${et(lang, 'welcome.questions')}</p>
    `,
      lang
    ),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Welcome email sent to:', email, `[${lang}]`);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
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
