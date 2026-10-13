// A newsletter to all players: one piece of content per language, rendered by
// sendNewsletterEmail (services/emailService.ts) in the brand look. Plain text only; it is escaped.

export interface NewsletterItem {
  title: string;
  text: string;
}

export interface NewsletterSection {
  title: string;
  items: NewsletterItem[];
}

export interface NewsletterContent {
  subject: string;
  banner: string;
  intro: string;
  sections: NewsletterSection[];
  // The one thing the newsletter wants the reader to act on: a heading, a few paragraphs and a
  // button that opens an email to Kimi.
  callout: { title: string; paragraphs: string[]; button: string; mailSubject: string };
  closing: string;
}

export type Newsletter = Record<'en' | 'nl', NewsletterContent>;
