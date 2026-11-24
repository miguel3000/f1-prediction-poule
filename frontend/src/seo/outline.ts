// What search engines and AI bots read on each public page.
//
// The app is a React single-page app, and most AI crawlers (and a lot of link-preview bots) do not run
// JavaScript, so on their own they only see an empty <div id="root">. The server puts the text listed here
// inside that div (backend/src/utils/seoContent.ts), and builds /llms.txt and /llms-full.txt from it.
// The wording is NOT written again here: every block points at a key of the same locale files the pages
// use, so the text a bot reads is the text a player reads, in both languages.
//
// `vite.seo.ts` turns this file into dist/seo-content.json at build time and fails the build when a key
// is missing or still has a {placeholder}. A typo in a key does not compile.
//
// A new public page: add it here (and to the places listed in decisions.md "A new public page").
import type { en } from '../i18n/locales/en';
import { MAIN_POINTS, SPRINT_POINTS } from '../data/points';

type Key = keyof typeof en;

// A list item is one key, a label key followed by a text key ("Email:" + "..."), or a label and a literal.
export type SeoItem = Key | [Key, Key] | { label: Key; value: string };

export type SeoBlock =
  | { h: 1 | 2 | 3; key: Key }
  | { p: Key; vars?: Record<string, string> }
  | { ul: SeoItem[] }
  | { faq: Array<[Key, Key]> } // question, answer; also becomes FAQPage structured data
  | { links: Array<{ path: string; label: Key }> };

export interface SeoPage {
  path: string; // the English address; the Dutch one is /nl + path
  title: Key;
  description: Key;
  blocks: SeoBlock[];
}

const list = (points: number[]) => points.join(', ');
const numbered = (prefix: string, n: number, suffix: string) =>
  Array.from({ length: n }, (_, i) => `${prefix}${i + 1}${suffix}` as Key);

// Links every page ends with, so a crawler can walk from any public page to all the others.
const NAV: SeoBlock = {
  links: [
    { path: '/', label: 'nav.home' },
    { path: '/tutorial', label: 'nav.tutorial' },
    { path: '/rules', label: 'nav.rules' },
    { path: '/about', label: 'nav.about' },
    { path: '/privacy', label: 'nav.privacy' },
    { path: '/auth', label: 'home.loginRegister' },
  ],
};

export const SEO_PAGES: SeoPage[] = [
  {
    path: '/',
    title: 'meta.home.title',
    description: 'meta.home.desc',
    blocks: [
      { h: 1, key: 'meta.home.title' },
      { p: 'meta.home.desc' },
      { p: 'about.welcome.text' },
      { h: 2, key: 'about.how.title' },
      ...[1, 2, 3, 4, 5].flatMap((n): SeoBlock[] => [
        { h: 3, key: `about.how.${n}.title` as Key },
        { p: `about.how.${n}.text` as Key },
      ]),
      { h: 2, key: 'about.free.title' },
      { p: 'about.free.text' },
      NAV,
    ],
  },
  {
    path: '/about',
    title: 'meta.about.title',
    description: 'meta.about.desc',
    blocks: [
      { h: 1, key: 'about.title' },
      { h: 2, key: 'about.welcome.title' },
      { p: 'about.welcome.text' },
      { h: 2, key: 'about.what.title' },
      { p: 'about.what.intro' },
      { ul: [1, 2, 3, 4, 5].map((n): SeoItem => [`about.what.${n}.label` as Key, `about.what.${n}.text` as Key]) },
      { h: 2, key: 'about.how.title' },
      ...[1, 2, 3, 4, 5].flatMap((n): SeoBlock[] => [
        { h: 3, key: `about.how.${n}.title` as Key },
        { p: `about.how.${n}.text` as Key },
      ]),
      { h: 2, key: 'about.mission.title' },
      { p: 'about.mission.text' },
      { h: 2, key: 'about.tech.title' },
      { p: 'about.tech.intro' },
      { ul: [1, 2, 3, 4].map((n): SeoItem => [`about.tech.${n}.label` as Key, `about.tech.${n}.text` as Key]) },
      { h: 2, key: 'about.fair.title' },
      { p: 'about.fair.intro' },
      { ul: numbered('about.fair.', 4, '') },
      { h: 2, key: 'about.community.title' },
      { p: 'about.community.text' },
      { h: 2, key: 'about.free.title' },
      { p: 'about.free.text' },
      { h: 2, key: 'about.disclaimer.title' },
      { p: 'about.disclaimer.intro' },
      { ul: ['about.disclaimer.4'] },
      { p: 'about.disclaimer.text' },
      { h: 2, key: 'about.contact.title' },
      { p: 'about.contact.intro' },
      { ul: [{ label: 'about.contact.email', value: 'kimi@pouleposition.nl' }] },
      NAV,
    ],
  },
  {
    path: '/tutorial',
    title: 'meta.tutorial.title',
    description: 'meta.tutorial.desc',
    blocks: [
      { h: 1, key: 'tutorial.title' },
      { p: 'tutorial.subtitle' },
      { h: 2, key: 'tutorial.s1.title' },
      { p: 'tutorial.s1.text' },
      { h: 2, key: 'tutorial.s2.title' },
      { p: 'tutorial.s2.text' },
      { p: 'tutorial.s2.tip' },
      { h: 2, key: 'tutorial.s3.title' },
      { p: 'tutorial.s3.text' },
      { h: 2, key: 'tutorial.s4.title' },
      { p: 'tutorial.s4.text' },
      { p: 'tutorial.s4.forgot' },
      { h: 2, key: 'tutorial.s5.title' },
      { p: 'tutorial.s5.text' },
      { h: 2, key: 'tutorial.s6.title' },
      { p: 'tutorial.s6.text' },
      { p: 'tutorial.s6.spoiler' },
      { h: 2, key: 'tutorial.score.title' },
      { p: 'tutorial.score.intro' },
      {
        ul: [
          ['tutorial.score.exact', 'tutorial.score.exactText'],
          ['tutorial.score.near', 'tutorial.score.nearText'],
          ['tutorial.score.miss', 'tutorial.score.missText'],
        ],
      },
      { p: 'seo.points.main', vars: { list: list(MAIN_POINTS) } },
      { p: 'seo.points.sprint', vars: { list: list(SPRINT_POINTS) } },
      { h: 2, key: 'tutorial.example.title' },
      { p: 'tutorial.example.intro' },
      { p: 'tutorial.example.total' },
      { h: 2, key: 'tutorial.faq.title' },
      { faq: Array.from({ length: 12 }, (_, i): [Key, Key] => [`tutorial.faq.q${i + 1}` as Key, `tutorial.faq.a${i + 1}` as Key]) },
      NAV,
    ],
  },
  {
    path: '/rules',
    title: 'meta.rules.title',
    description: 'meta.rules.desc',
    blocks: [
      { h: 1, key: 'rules.title' },
      { h: 2, key: 'rules.how.title' },
      { ul: numbered('rules.how.', 5, '') },
      { h: 2, key: 'rules.scoring.title' },
      { p: 'rules.scoring.intro' },
      { p: 'seo.points.main', vars: { list: list(MAIN_POINTS) } },
      { ul: ['rules.exact.text', 'rules.near.text', 'rules.miss.text'] },
      { ul: ['rules.exact.example', 'rules.near.example', 'rules.miss.example'] },
      { p: 'rules.note' },
      { h: 2, key: 'rules.dnf.title' },
      { p: 'rules.dnf.text' },
      { h: 3, key: 'rules.dnfdns.title' },
      { p: 'rules.dnfdns.dnf' },
      { p: 'rules.dnfdns.dns' },
      { p: 'rules.dnfdns.other' },
      { h: 2, key: 'rules.deadlines.title' },
      { ul: numbered('rules.deadlines.', 5, '') },
      { h: 2, key: 'rules.sprint.title' },
      { p: 'rules.sprint.intro' },
      { p: 'seo.points.sprint', vars: { list: list(SPRINT_POINTS) } },
      { p: 'rules.sprint.footer' },
      { h: 2, key: 'rules.season.title' },
      { p: 'rules.season.text' },
      { h: 2, key: 'rules.notif.title' },
      { ul: numbered('rules.notif.', 3, '') },
      { h: 2, key: 'rules.processing.title' },
      { p: 'rules.processing.intro' },
      { h: 3, key: 'rules.stage1.title' },
      { p: 'rules.stage1.text' },
      { h: 3, key: 'rules.stage2.title' },
      { p: 'rules.stage2.text' },
      { p: 'rules.stages.note' },
      { h: 2, key: 'rules.fair.title' },
      { p: 'rules.fair.text' },
      NAV,
    ],
  },
  {
    path: '/privacy',
    title: 'meta.privacy.title',
    description: 'meta.privacy.desc',
    blocks: [
      { h: 1, key: 'privacy.title' },
      { ul: [['privacy.updated', 'privacy.updatedValue']] },
      { h: 2, key: 's1.title' },
      { p: 's1.text' },
      { h: 2, key: 's2.title' },
      { h: 3, key: 's2.1.title' },
      { ul: ['email', 'password', 'nickname', 'avatar', 'predictions'].map((k): SeoItem => [`s2.1.${k}.label` as Key, `s2.1.${k}.text` as Key]) },
      { h: 3, key: 's2.2.title' },
      { p: 's2.2.text' },
      { h: 2, key: 's3.title' },
      { ul: [1, 2, 3, 4].map((n): SeoItem => [`s3.${n}.label` as Key, `s3.${n}.text` as Key]) },
      { p: 's3.note' },
      { h: 2, key: 's4.title' },
      { h: 3, key: 's4.1.title' },
      { p: 's4.1.text' },
      { h: 3, key: 's4.2.title' },
      { p: 's4.2.text' },
      { h: 2, key: 's5.title' },
      { p: 's5.text' },
      { h: 2, key: 's6.title' },
      { p: 's6.text' },
      { h: 2, key: 's7.title' },
      { p: 's7.intro' },
      { ul: [1, 2, 3, 4].map((n): SeoItem => [`s7.${n}.label` as Key, `s7.${n}.text` as Key]) },
      { p: 's7.note' },
      { h: 2, key: 's8.title' },
      { p: 's8.text' },
      { h: 2, key: 's9.title' },
      { p: 's9.intro' },
      { ul: [{ label: 's9.email', value: 'kimi@pouleposition.nl' }, { label: 's9.website', value: 'https://pouleposition.nl' }] },
      { h: 2, key: 's10.title' },
      { p: 's10.text' },
      NAV,
    ],
  },
];
