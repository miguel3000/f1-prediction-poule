import { Request, Response } from 'express';
import {
  runCheck,
  emailPendingFlags,
  getWatchWindow,
  getLastCheck,
  listDocuments,
  CheckDeps,
} from '../services/fiaDocumentsService';
import { fetchFiaListing, fetchFiaPdfText } from '../services/fiaDocumentsIo';

// Pitlane side of the weekend flags: what the watcher has seen, and a "Check now" button.
// The IO is injectable so the tests need no network.
export const createFlagsHandlers = (deps: Partial<CheckDeps> = {}) => {
  const io: CheckDeps = {
    fetchListing: deps.fetchListing ?? fetchFiaListing,
    fetchPdfText: deps.fetchPdfText ?? fetchFiaPdfText,
    now: deps.now,
  };
  const clock = () => (io.now ? io.now() : new Date());
  let running = false; // a check can take a minute; two at once would read the same documents twice

  const listFlags = async (_req: Request, res: Response) => {
    try {
      const [window, lastCheck, documents] = await Promise.all([
        getWatchWindow(clock()),
        getLastCheck(),
        listDocuments(60),
      ]);
      res.json({
        window: window ? { raceName: window.raceName, start: window.start, end: window.end } : null,
        lastCheck,
        documents,
      });
    } catch (error) {
      console.error('List flags error:', error);
      res.status(500).json({ error: 'Failed to load the race weekend flags' });
    }
  };

  const checkNow = async (_req: Request, res: Response) => {
    if (running) return res.status(409).json({ error: 'A check is already running' });
    running = true;
    try {
      const result = await runCheck(io);
      const mailed = await emailPendingFlags(clock());
      res.json({
        ran: result.ran,
        ok: result.ok,
        added: result.added,
        flagged: result.flagged,
        emailed: mailed.sent,
        ...(result.error ? { error: result.error } : {}),
      });
    } catch (error) {
      console.error('Check flags error:', error);
      res.status(500).json({ error: 'Failed to check the FIA documents' });
    } finally {
      running = false;
    }
  };

  return { listFlags, checkNow };
};

export const { listFlags, checkNow } = createFlagsHandlers();
