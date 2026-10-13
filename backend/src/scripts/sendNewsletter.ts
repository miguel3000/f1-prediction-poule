import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { sendNewsletterEmail } from '../services/emailService';
import { whatsNewOct2026 } from '../newsletters/whatsNewOct2026';

// Sends the newsletter to every player who has not unsubscribed from announcements, each in
// their own language. Nothing is sent unless --send is given.
//
//   node dist/scripts/sendNewsletter.js                       list who would get it (nicknames only)
//   node dist/scripts/sendNewsletter.js --send                send to everyone subscribed
//   node dist/scripts/sendNewsletter.js --send --only a,b     send only to these nicknames (retry)
//   node dist/scripts/sendNewsletter.js --preview <nickname>  send only to that player's own address

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};

async function main() {
  const send = process.argv.includes('--send');
  const only = arg('--only')?.split(',').map((n) => n.trim().toLowerCase());
  const preview = arg('--preview')?.trim().toLowerCase();

  const result = await query(
    'SELECT id, email, nickname, language FROM users WHERE email_opt_out = FALSE ORDER BY nickname'
  );
  let users = result.rows;
  if (preview) users = users.filter((u) => u.nickname.toLowerCase() === preview);
  else if (only) users = users.filter((u) => only.includes(u.nickname.toLowerCase()));

  console.log(`${users.length} recipient(s): ${users.map((u) => `${u.nickname} [${u.language ?? 'en'}]`).join(', ')}`);
  if (!send && !preview) {
    console.log('Dry run: nothing sent. Add --send to send.');
    process.exit(0);
  }

  let ok = 0;
  const failed: string[] = [];
  for (const user of users) {
    const token = jwt.sign({ userId: user.id, purpose: 'unsubscribe' }, process.env.JWT_SECRET!);
    const unsubscribeUrl = `${process.env.FRONTEND_URL}/api/auth/unsubscribe?token=${token}`;
    const sent = await sendNewsletterEmail(user.email, user.nickname, user.language, whatsNewOct2026, unsubscribeUrl);
    if (sent) ok++;
    else failed.push(user.nickname);
  }
  console.log(`Newsletter: ${ok} sent, ${failed.length} failed${failed.length ? ` (${failed.join(', ')})` : ''}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error('Newsletter failed:', error);
  process.exit(1);
});
