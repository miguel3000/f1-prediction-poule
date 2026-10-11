import { query } from '../config/database';
import { sendWelcomeEmail, sendMemberNotice, MemberNoticeDetails } from './emailService';

// Sign-up and departure emails go through here so that every attempt is written to the
// database: a send that fails (SMTP down, wrong password) is retried automatically and
// shows up in the Pitlane instead of vanishing with the container log.

export type LoggedEmailKind = 'welcome' | 'member_joined' | 'member_left';

export interface WelcomePayload {
  nickname: string;
  language?: string | null;
}

type Payload = WelcomePayload | MemberNoticeDetails;

const MAX_ATTEMPTS = 5;
const RETRY_EVERY_MINUTES = 10; // grows with every attempt: 10, 20, 30, 40 minutes
const GIVE_UP_AFTER_HOURS = 24;
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 500);

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
    await query(`UPDATE email_log SET status = 'sent', last_error = NULL, updated_at = NOW() WHERE id = $1`, [id]);
  } catch (error) {
    console.error(`Email (${kind}, log #${id}) failed:`, error);
    await query(`UPDATE email_log SET status = 'failed', last_error = $2, updated_at = NOW() WHERE id = $1`, [id, errorText(error)]);
  }
};

export const sendLogged = async (
  kind: LoggedEmailKind,
  userId: number | null,
  recipient: string,
  payload: Payload,
  opts: { late?: boolean } = {}
): Promise<void> => {
  const { rows } = await query(
    `INSERT INTO email_log (kind, user_id, recipient, payload) VALUES ($1, $2, $3, $4) RETURNING id`,
    [kind, userId, recipient, JSON.stringify(payload)]
  );
  await attempt(rows[0].id, kind, recipient, payload, !!opts.late);
};

// Recorded but deliberately not sent (the hourly sign-up cap).
export const logSkipped = async (
  kind: LoggedEmailKind,
  userId: number | null,
  recipient: string,
  payload: Payload,
  reason: string
): Promise<void> => {
  await query(
    `INSERT INTO email_log (kind, user_id, recipient, payload, status, last_error) VALUES ($1, $2, $3, $4, 'skipped', $5)`,
    [kind, userId, recipient, JSON.stringify(payload), reason]
  );
};

// Tries again for emails that failed, or whose attempt was cut off by a restart.
// Runs every few minutes from server.ts.
export const retryFailedEmails = async (): Promise<void> => {
  const { rows } = await query(
    `SELECT id, kind, user_id, recipient, payload FROM email_log
     WHERE status IN ('failed', 'pending')
       AND attempts < $1
       AND created_at > NOW() - make_interval(hours => $2)
       AND updated_at < NOW() - (attempts * make_interval(mins => $3))
     ORDER BY id
     LIMIT 20`,
    [MAX_ATTEMPTS, GIVE_UP_AFTER_HOURS, RETRY_EVERY_MINUTES]
  );

  for (const row of rows) {
    // No point welcoming someone who has deleted their account in the meantime.
    if (row.kind === 'welcome') {
      const user = await query('SELECT 1 FROM users WHERE id = $1', [row.user_id]);
      if (user.rows.length === 0) {
        await query(`UPDATE email_log SET status = 'skipped', last_error = 'account deleted', updated_at = NOW() WHERE id = $1`, [row.id]);
        continue;
      }
    }
    await attempt(row.id, row.kind, row.recipient, row.payload);
  }
};

// First pass shortly after start-up (picks up anything a restart cut off), then every few minutes.
export const startEmailRetries = (): void => {
  const run = () => retryFailedEmails().catch((error) => console.error('Email retry failed:', error));
  setTimeout(run, 60 * 1000).unref();
  setInterval(run, 5 * 60 * 1000).unref();
};
