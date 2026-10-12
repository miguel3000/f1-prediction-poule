import { query } from '../config/database';
import { sendWelcomeEmail, sendMemberNotice, MemberNoticeDetails } from './emailService';

// Sign-up and departure emails go through here so that every attempt is written to the
// database: a send that fails (SMTP down, wrong password) is retried automatically and
// shows up in the Pitlane instead of vanishing with the container log.
//
// Privacy: the log never keeps a player's email address. The welcome mail looks the address up
// from the player's account when it is sent; the admin notices carry it in `payload.email`
// only until they are delivered (or given up on), then it is removed. Error texts from the
// mail server often quote the address, so those are masked too.

export type LoggedEmailKind = 'welcome' | 'member_joined' | 'member_left';

export interface WelcomePayload {
  nickname: string;
  language?: string | null;
}

type Payload = WelcomePayload | MemberNoticeDetails;

const MAX_ATTEMPTS = 5;
const RETRY_EVERY_MINUTES = 10; // grows with every attempt: 10, 20, 30, 40 minutes
const GIVE_UP_AFTER_HOURS = 24;
const maskAddresses = (text: string) => text.replace(/[^\s<>"',;:()]+@[^\s<>"',;:()]+/g, '[address]');
const errorText = (error: unknown) => maskAddresses(error instanceof Error ? error.message : String(error)).slice(0, 500);

const dispatch = async (kind: LoggedEmailKind, recipient: string, payload: Payload, late: boolean) => {
  if (kind === 'welcome') {
    const { nickname, language } = payload as WelcomePayload;
    await sendWelcomeEmail(recipient, nickname, language, { late });
  } else {
    await sendMemberNotice(payload as MemberNoticeDetails);
  }
};

// One delivery attempt for an existing log row. Never throws: the outcome is the row's status.
const attempt = async (id: number, kind: LoggedEmailKind, recipient: string, payload: Payload, late = false) => {
  // Counted before sending, so a crash mid-send still shows as an attempt and is retried later.
  await query(`UPDATE email_log SET attempts = attempts + 1, status = 'pending', updated_at = NOW() WHERE id = $1`, [id]);
  try {
    await dispatch(kind, recipient, payload, late);
    await query(`UPDATE email_log SET status = 'sent', last_error = NULL, payload = payload - 'email', updated_at = NOW() WHERE id = $1`, [id]);
  } catch (error) {
    console.error(`Email (${kind}, log #${id}) failed:`, error);
    await query(`UPDATE email_log SET status = 'failed', last_error = $2, updated_at = NOW() WHERE id = $1`, [id, errorText(error)]);
  }
};

// `address` is what the welcome mail is sent to. It is used for this attempt only and is not
// stored: a retry looks it up from the account again.
export const sendLogged = async (
  kind: LoggedEmailKind,
  userId: number | null,
  address: string,
  payload: Payload,
  opts: { late?: boolean } = {}
): Promise<void> => {
  const { rows } = await query(
    `INSERT INTO email_log (kind, user_id, payload) VALUES ($1, $2, $3) RETURNING id`,
    [kind, userId, JSON.stringify(payload)]
  );
  await attempt(rows[0].id, kind, address, payload, !!opts.late);
};

// Recorded but deliberately not sent (the hourly sign-up cap).
export const logSkipped = async (
  kind: LoggedEmailKind,
  userId: number | null,
  payload: Payload,
  reason: string
): Promise<void> => {
  const { email: _email, ...withoutAddress } = payload as Payload & { email?: string };
  await query(
    `INSERT INTO email_log (kind, user_id, payload, status, last_error) VALUES ($1, $2, $3, 'skipped', $4)`,
    [kind, userId, JSON.stringify(withoutAddress), reason]
  );
};

// Tries again for emails that failed, or whose attempt was cut off by a restart.
// Runs every few minutes from server.ts.
export const retryFailedEmails = async (): Promise<void> => {
  // Whatever is no longer being retried must not keep the address it carried.
  await query(
    `UPDATE email_log SET payload = payload - 'email'
     WHERE payload ? 'email' AND status IN ('failed', 'pending')
       AND (attempts >= $1 OR created_at <= NOW() - make_interval(hours => $2))`,
    [MAX_ATTEMPTS, GIVE_UP_AFTER_HOURS]
  );

  const { rows } = await query(
    `SELECT l.id, l.kind, l.user_id, l.payload, u.email AS account_email
     FROM email_log l
     LEFT JOIN users u ON u.id = l.user_id
     WHERE l.status IN ('failed', 'pending')
       AND l.attempts < $1
       AND l.created_at > NOW() - make_interval(hours => $2)
       AND l.updated_at < NOW() - (l.attempts * make_interval(mins => $3))
     ORDER BY l.id
     LIMIT 20`,
    [MAX_ATTEMPTS, GIVE_UP_AFTER_HOURS, RETRY_EVERY_MINUTES]
  );

  for (const row of rows) {
    // The welcome mail goes to the address on the account as it is now. No point welcoming
    // someone who has deleted their account in the meantime.
    if (row.kind === 'welcome' && !row.account_email) {
      await query(`UPDATE email_log SET status = 'skipped', last_error = 'account deleted', updated_at = NOW() WHERE id = $1`, [row.id]);
      continue;
    }
    // A notice whose details were already removed cannot be rebuilt.
    if (row.kind !== 'welcome' && !row.payload?.email) {
      await query(`UPDATE email_log SET status = 'skipped', last_error = 'details no longer kept', updated_at = NOW() WHERE id = $1`, [row.id]);
      continue;
    }
    await attempt(row.id, row.kind, row.account_email ?? '', row.payload);
  }
};

// First pass shortly after start-up (picks up anything a restart cut off), then every few minutes.
export const startEmailRetries = (): void => {
  const run = () => retryFailedEmails().catch((error) => console.error('Email retry failed:', error));
  setTimeout(run, 60 * 1000).unref();
  setInterval(run, 5 * 60 * 1000).unref();
};
