import { Newsletter } from './types';
import { whatsNewOct2026 } from './whatsNewOct2026';
import { didYouKnowNov2026 } from './didYouKnowNov2026';

// Every newsletter that can be sent, by the name given to scripts/sendNewsletter.ts. There is no
// default on purpose: sending "the newsletter" must never mean an old one again by accident.
export const newsletters: Record<string, Newsletter> = {
  'whats-new-oct-2026': whatsNewOct2026,
  'did-you-know-nov-2026': didYouKnowNov2026,
};

export const getNewsletter = (name: string | undefined): Newsletter => {
  if (name && Object.prototype.hasOwnProperty.call(newsletters, name)) return newsletters[name];
  throw new Error(`Choose a newsletter with --newsletter <name>. Available: ${Object.keys(newsletters).join(', ')}`);
};
