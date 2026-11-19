import {
  findPreviewWeekend,
  listRecipients,
  runAutomaticPreview,
  sendRacePreviews,
  sendRacePreviewTest,
} from '../services/racePreviewService';

// The Thursday race weekend preview (services/racePreviewService.ts).
//
//   node dist/scripts/sendRacePreviews.js                         the hourly Thursday job: sends only while the Pitlane switch is on
//   node dist/scripts/sendRacePreviews.js --dry-run               shows the weekend and who would get it (nicknames only), sends nothing
//   node dist/scripts/sendRacePreviews.js --preview <nickname>    sends it to that player's own address only, records nothing
//   node dist/scripts/sendRacePreviews.js --send-now [--only a,b] sends now, switch or no switch, to everyone who has not had it
//
// A run that stops half way is continued by the next one: only players without a row in
// race_preview_log are mailed, and each success is recorded as it happens.

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const has = (name: string) => process.argv.includes(name);

async function main() {
  const prefix = '[CRON] Race preview:';

  if (has('--dry-run')) {
    const weekend = await findPreviewWeekend();
    if (!weekend) {
      console.log(`${prefix} no race starts within the next days, nothing would be sent.`);
      return 0;
    }
    const who = await listRecipients(weekend);
    console.log(`${prefix} ${weekend.raceName}${weekend.sprintRaceId ? ' (sprint weekend)' : ''}: ${who.length} player(s) would get it: ${who.map((w) => `${w.nickname} [${w.language ?? 'en'}]`).join(', ')}`);
    console.log('Dry run: nothing sent.');
    return 0;
  }

  const preview = arg('--preview');
  if (preview) {
    const result = await sendRacePreviewTest({ nickname: preview });
    console.log(result ? `${prefix} test of ${result.raceName} sent to ${result.to} only, nothing recorded.` : `${prefix} no such player, or no race weekend is due.`);
    return result ? 0 : 1;
  }

  const only = arg('--only')?.split(',').map((n) => n.trim());
  const run = has('--send-now') ? { ...(await sendRacePreviews({}, { nicknames: only })), switchedOff: false } : await runAutomaticPreview();
  if (run.switchedOff) {
    console.log(`${prefix} switched off in the Pitlane, nothing sent.`);
    return 0;
  }
  if (run.raceName === null) {
    console.log(`${prefix} no race starts within the next days, nothing to send.`);
    return 0;
  }
  console.log(`${prefix} ${run.raceName}: ${run.sent} sent, ${run.failed.length} failed${run.failed.length ? ` (${run.failed.join(', ')}); the next run retries them` : ''}`);
  return run.failed.length ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('[CRON] Race preview failed:', error);
    process.exit(1);
  });
