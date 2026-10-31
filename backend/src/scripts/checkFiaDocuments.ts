import { runCheck, emailPendingFlags } from '../services/fiaDocumentsService';
import { fetchFiaListing, fetchFiaPdfText } from '../services/fiaDocumentsIo';

/**
 * Weekend flags: reads the FIA's decision documents and emails the owner what probably changes
 * predictions. Runs every 10 minutes; outside the window before a main race it does nothing.
 */
async function checkFiaDocuments() {
  try {
    const result = await runCheck({ fetchListing: fetchFiaListing, fetchPdfText: fetchFiaPdfText });
    if (result.ran) {
      console.log('[CRON] FIA documents check:', JSON.stringify(result));
    }
    // Also sends flags recorded elsewhere (the live feed) and retries mails that failed before.
    const mailed = await emailPendingFlags(new Date());
    if (mailed.sent > 0) console.log(`[CRON] Weekend flags emailed: ${mailed.sent}`);
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error('[CRON] FIA documents check crashed:', error);
    process.exit(1);
  }
}

checkFiaDocuments();
