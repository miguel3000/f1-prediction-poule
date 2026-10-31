// Reads the FIA's decision-documents page and the text of its PDFs (weekend flags). Pure functions:
// no network, no database, so they are tested on real documents saved as fixtures.

export type DocKind = 'driver_change' | 'entry_list' | 'infringement' | 'decision' | 'summons' | 'pu_report' | 'other';

export interface ListedDocument {
  url: string;
  docNumber: number | null;
  title: string;
  publishedAt: Date;
}

export interface ParsedFacts {
  severity: 'flag' | 'seen';
  understood: boolean;
  summary: string;
  facts: Record<string, unknown>;
}

const FIA_ORIGIN = 'https://www.fia.com';

const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim();

const decodeEntities = (s: string): string =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const stripTags = (s: string): string => collapse(decodeEntities(s.replace(/<[^>]+>/g, ' ')));

// The listing shows times as dd.mm.yy hh:mm in Amsterdam time (it labels them CET, also in summer).
const amsterdamOffsetMinutes = (utcMs: number): number => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const localAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return (localAsUtc - utcMs) / 60000;
};

const amsterdamToUtc = (year: number, month: number, day: number, hour: number, minute: number): Date => {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = amsterdamOffsetMinutes(guess);
  let result = guess - offset * 60000;
  const second = amsterdamOffsetMinutes(result); // across a clock change the first guess can be an hour off
  if (second !== offset) result = guess - second * 60000;
  return new Date(result);
};

// The first, expanded event block of the page is the current event; the others are collapsed
// and carry no documents. Null when the page has no such block (it changed shape).
export const parseListing = (html: string): { event: string; documents: ListedDocument[] } | null => {
  const start = html.indexOf('<div class="event-title active">');
  if (start === -1) return null;
  const titleEnd = html.indexOf('</div>', start);
  if (titleEnd === -1) return null;
  const event = stripTags(html.slice(start, titleEnd));
  const nextEvent = html.indexOf('<div class="event-title', start + 10);
  const block = html.slice(titleEnd, nextEvent === -1 ? undefined : nextEvent);

  const documents: ListedDocument[] = [];
  for (const row of block.split('<li class="document-row').slice(1)) {
    const href = row.match(/href="([^"]+\.pdf)"/)?.[1];
    const titleStart = row.indexOf('<div class="title">');
    const publishedStart = row.indexOf('<div class="published">');
    const when = row.match(/date-display-single">(\d{2})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2})</);
    if (!href || titleStart === -1 || publishedStart === -1 || !when) continue;

    let title = stripTags(row.slice(titleStart, publishedStart));
    let docNumber: number | null = null;
    const numbered = title.match(/^(Recalled - )?Doc (\d+) - (.*)$/);
    if (numbered) {
      docNumber = Number(numbered[2]);
      title = `${numbered[1] ?? ''}${numbered[3]}`;
    }
    const [, dd, mm, yy, hh, min] = when;
    documents.push({
      url: href.startsWith('http') ? href : FIA_ORIGIN + href,
      docNumber,
      title,
      publishedAt: amsterdamToUtc(2000 + Number(yy), Number(mm), Number(dd), Number(hh), Number(min)),
    });
  }
  return { event, documents };
};

// Titles decide which documents are worth opening. The order matters: the specific skips come first.
export const classifyTitle = (title: string): { read: boolean; kind: DocKind } => {
  if (/^recalled\b/i.test(title)) return { read: false, kind: 'other' };
  if (/deleted lap times/i.test(title)) return { read: false, kind: 'other' };
  if (/driver change/i.test(title)) return { read: true, kind: 'driver_change' };
  if (/revised entry list/i.test(title)) return { read: true, kind: 'entry_list' };
  if (/^infring/i.test(title)) return { read: true, kind: 'infringement' };
  if (/^decision\b/i.test(title)) return { read: true, kind: 'decision' };
  if (/^summons\b/i.test(title)) return { read: true, kind: 'summons' };
  if (/pu elements|power unit elements/i.test(title)) return { read: true, kind: 'pu_report' };
  // A title the FIA words differently from the ones above but that sounds like a penalty is read rather
  // than skipped: missing exactly this news is the failure this watcher exists to prevent.
  if (/penalt|offence|disqualif|exclu(?:sion|ded)|withdraw|pit ?lane start|start from the pit/i.test(title)) {
    return { read: true, kind: 'decision' };
  }
  return { read: false, kind: 'other' };
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
const toNumber = (word: string): number => (/^\d+$/.test(word) ? Number(word) : NUMBER_WORDS[word.toLowerCase()]);

const NOT_UNDERSTOOD = (summary: string): ParsedFacts => ({ severity: 'seen', understood: false, summary, facts: {} });

const parseDriverChange = (text: string): ParsedFacts => {
  const t = collapse(text);
  const original = t.match(/change the driver of car (\d+), ([^.]+?)\./i);
  const replacement = t.match(/the driver, ([^,]+), with the car number (\d+)/i);
  if (!original || !replacement) {
    return { severity: 'flag', understood: false, summary: 'Driver change (details could not be read)', facts: {} };
  }
  const facts = {
    originalNumber: Number(original[1]),
    originalName: original[2].trim(),
    replacementNumber: Number(replacement[2]),
    replacementName: replacement[1].trim(),
  };
  return {
    severity: 'flag',
    understood: true,
    summary: `Driver change: ${facts.replacementName} (#${facts.replacementNumber}) replaces ${facts.originalName} (#${facts.originalNumber})`,
    facts,
  };
};

const parseDecision = (text: string): ParsedFacts => {
  const t = collapse(text);
  const decision = t.match(/\sDecision\s+(.+?)\s+Reason\s/)?.[1]?.trim();
  if (!decision) return NOT_UNDERSTOOD('Decision could not be read');

  const who = t.match(/No \/ Driver\s+(\d+)\s*-\s*(.+?)\s+Competitor\b/);
  const carNumber = who ? Number(who[1]) : undefined;
  const driverName = who ? who[2].trim() : undefined;

  const drop =
    decision.match(/drop of (\d+|one|two|three|four|five|six|seven|eight|nine|ten) grid position/i) ??
    decision.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)[- ]place grid penalty/i) ??
    decision.match(/grid penalty of (\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i);
  const gridDrop = drop ? toNumber(drop[1]) : undefined;
  const pitLane = /pit ?lane start|start(?:ing)? (?:the race )?from the pit ?lane/i.test(decision) || undefined;
  const disqualified = /disqualif|exclu(?:ded|sion)/i.test(decision) || undefined;

  const facts: Record<string, unknown> = { carNumber, driverName, decision };
  if (gridDrop !== undefined) facts.gridDrop = gridDrop;
  if (pitLane) facts.pitLane = true;
  if (disqualified) facts.disqualified = true;

  const who2 = carNumber !== undefined ? `#${carNumber} ${driverName}` : 'Driver';
  const flag = gridDrop !== undefined || pitLane || disqualified;
  let what: string;
  if (gridDrop !== undefined) what = `${gridDrop}-place grid drop`;
  else if (pitLane) what = 'starts from the pit lane';
  else if (disqualified) what = decision.slice(0, 120);
  else what = decision.slice(0, 120);
  return { severity: flag ? 'flag' : 'seen', understood: true, summary: `${who2}: ${what}`, facts };
};

const SEEN_SUMMARY: Record<string, string> = {
  entry_list: 'Revised entry list published',
  summons: 'Summons issued (a decision is pending)',
  pu_report: 'New power-unit elements reported (see the penalty documents)',
  other: '',
};

export const parseDocumentText = (kind: DocKind, text: string): ParsedFacts => {
  if (kind === 'driver_change') return parseDriverChange(text);
  if (kind === 'infringement' || kind === 'decision') return parseDecision(text);
  return { severity: 'seen', understood: true, summary: SEEN_SUMMARY[kind] ?? '', facts: {} };
};
