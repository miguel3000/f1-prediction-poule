import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { renderIndex } from '../seoMeta';
import { loadSeoContent, clearSeoContentCache, renderLlmsTxt, renderLlmsFullTxt } from '../seoContent';

// The real page shell, and a small stand-in for dist/seo-content.json (the frontend build writes the real one
// from the locale files: frontend/vite.seo.ts).
const INDEX = path.resolve(__dirname, '../../../../frontend/index.html'); // from dist/utils/__tests__

const NAV = (en: boolean) => ({
  type: 'links', label: en ? 'More about Poule Position' : 'Meer over Poule Position',
  items: [
    { path: '/', label: en ? 'Home' : 'Home' },
    { path: '/rules', label: en ? 'Rules' : 'Regels' },
    { path: '/auth', label: en ? 'Login / Register' : 'Inloggen / Registreren' },
  ],
});
const content = {
  version: 1,
  pages: [
    {
      path: '/',
      en: { title: 'Poule Position – F1 prediction game for friends', description: 'Predict the top 10 of every race.', blocks: [
        { type: 'h1', text: 'Poule Position – F1 prediction game for friends' }, { type: 'p', text: 'Predict the top 10 of every race.' }, NAV(true)] },
      nl: { title: 'F1-poule spelen met vrienden – Poule Position', description: 'Voorspel de top 10 van elke race.', blocks: [
        { type: 'h1', text: 'F1-poule spelen met vrienden – Poule Position' }, { type: 'p', text: 'Voorspel de top 10 van elke race.' }, NAV(false)] },
    },
    {
      path: '/rules',
      en: { title: 'Rules and scoring – Poule Position', description: 'How points are scored.', blocks: [
        { type: 'h1', text: 'Game Rules' }, { type: 'h2', text: 'Scoring System' },
        { type: 'p', text: 'Predict VER P1, finishes P1 → **25 pts** & more <b>x</b>' },
        { type: 'ul', items: ['**Register** with a nickname', 'Predict <script>alert(1)</script> the top 10'] }, NAV(true)] },
      nl: { title: 'Regels en puntentelling – Poule Position', description: 'Zo worden punten verdiend.', blocks: [
        { type: 'h1', text: 'Spelregels' }, { type: 'h2', text: 'Puntentelling' },
        { type: 'p', text: 'Voorspel VER P1, eindigt P1 → **25 pnt**' }, { type: 'ul', items: ['**Registreer** met een bijnaam'] }, NAV(false)] },
    },
    {
      path: '/tutorial',
      en: { title: 'How to play – Poule Position tutorial', description: 'Step by step.', blocks: [
        { type: 'h1', text: 'How to Play' }, { type: 'h2', text: 'Frequently asked questions' },
        { type: 'faq', items: [{ q: 'Does it cost anything?', a: 'No. **Completely** free.' }, { q: 'Can I change it?', a: 'Yes, until it locks </script><script>x</script>.' }] }, NAV(true)] },
      nl: { title: 'Zo speel je – Poule Position handleiding', description: 'Stap voor stap.', blocks: [
        { type: 'h1', text: 'Zo speel je' }, { type: 'h2', text: 'Veelgestelde vragen' },
        { type: 'faq', items: [{ q: 'Kost het iets?', a: 'Nee. **Helemaal** gratis.' }] }, NAV(false)] },
    },
  ],
};

let dir = '';
let bare = ''; // a shell with no seo-content.json next to it
before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-'));
  fs.copyFileSync(INDEX, path.join(dir, 'index.html'));
  fs.writeFileSync(path.join(dir, 'seo-content.json'), JSON.stringify(content));
  bare = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-bare-'));
  fs.copyFileSync(INDEX, path.join(bare, 'index.html'));
});
after(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(bare, { recursive: true, force: true });
});

const page = (p: string, lang: 'en' | 'nl' = 'en', where = dir) => renderIndex(path.join(where, 'index.html'), p, lang);
const root = (html: string) => /<div id="root">([\s\S]*?)<\/div>\s*<script type="module"/.exec(html)?.[1] ?? '';
const ldJson = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

// ---- the text of the page, for bots that do not run JavaScript ----
test('a_public_page_has_its_real_text_inside_the_root_for_bots_without_javascript', () => {
  const body = root(page('/rules'));
  assert.match(body, /<main id="seo-content">/);
  assert.match(body, /<h1>Game Rules<\/h1>/);
  assert.match(body, /<h2>Scoring System<\/h2>/);
  assert.match(body, /→ <strong>25 pts<\/strong>/);
  assert.match(body, /<li><strong>Register<\/strong> with a nickname<\/li>/);
  assert.ok(!body.includes('**'), 'raw bold markers left in the page');
});

test('the_dutch_address_gets_dutch_text_and_dutch_links', () => {
  const html = page('/nl/rules', 'en'); // a Dutch address is Dutch whatever the visitor asks for
  const body = root(html);
  assert.match(html, /<html lang="nl"/);
  assert.match(body, /<h1>Spelregels<\/h1>/);
  assert.match(body, /<a href="\/nl\/rules">Regels<\/a>/);
  assert.match(body, /<a href="\/nl">Home<\/a>/);
  assert.match(body, /<a href="\/auth">Inloggen \/ Registreren<\/a>/, 'the login page has no Dutch address');
  assert.ok(!body.includes('Game Rules'));
});

test('the_english_address_links_to_english_pages', () => {
  const body = root(page('/', 'en'));
  assert.match(body, /<a href="\/rules">Rules<\/a>/);
  assert.match(body, /<a href="\/">Home<\/a>/);
  assert.match(body, /<nav aria-label="More about Poule Position">/);
});

test('the_text_comes_with_a_small_stylesheet_that_only_touches_itself', () => {
  const css = /<style id="seo-content-style">([\s\S]*?)<\/style>/.exec(page('/rules'))?.[1];
  assert.ok(css, 'no stylesheet on a public page');
  const selectors = css!.split('}').map((rule) => rule.split('{')[0].trim()).filter(Boolean).flatMap((s) => s.split(',').map((x) => x.trim()));
  assert.ok(selectors.length >= 5, 'headings, lists and links are styled');
  for (const selector of selectors) assert.match(selector, /^#seo-content\b/, `"${selector}" could restyle the app`);
  assert.ok(!page('/leaderboard').includes('seo-content-style'), 'a page without the text has no stylesheet either');
  assert.ok(!page('/rules', 'en', bare).includes('seo-content-style'), 'no content file, no stylesheet');
});

test('a_faq_is_a_list_of_questions_and_answers', () => {
  const body = root(page('/tutorial'));
  assert.match(body, /<dt>Does it cost anything\?<\/dt>\s*<dd>No\. <strong>Completely<\/strong> free\.<\/dd>/);
});

test('page_text_is_escaped_so_no_markup_or_script_gets_through', () => {
  const html = page('/rules');
  const body = root(html);
  assert.ok(!body.includes('<script'), 'a script tag came through');
  assert.ok(!body.includes('<b>x'), 'player markup came through');
  assert.match(body, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(body, /&amp; more &lt;b&gt;x&lt;\/b&gt;/);
  const tutorial = page('/tutorial');
  assert.ok(!root(tutorial).includes('</script>'));
  assert.equal(tutorial.match(/<script/g)!.length, 2, 'only the app script and the structured data');
});

test('pages_behind_a_login_and_unknown_pages_keep_an_empty_root_and_noindex', () => {
  for (const p of ['/leaderboard', '/auth', '/nope']) {
    const html = page(p);
    assert.equal(root(html), '', `${p} has content in the root`);
    assert.match(html, /<meta name="robots" content="noindex, nofollow"/);
  }
});

test('without_the_content_file_the_page_still_works_with_its_head_only', () => {
  const html = page('/rules', 'en', bare);
  assert.equal(root(html), '');
  assert.match(html, /<title>Rules and scoring – Poule Position<\/title>/);
  assert.equal(loadSeoContent(bare), null);
});

test('a_broken_content_file_is_ignored_not_fatal', () => {
  const broken = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-broken-'));
  try {
    fs.copyFileSync(INDEX, path.join(broken, 'index.html'));
    fs.writeFileSync(path.join(broken, 'seo-content.json'), '{ not json');
    assert.equal(root(page('/rules', 'en', broken)), '');
    fs.writeFileSync(path.join(broken, 'seo-content.json'), JSON.stringify({ version: 99, pages: 'x' }));
    clearSeoContentCache();
    assert.equal(loadSeoContent(broken), null);
  } finally {
    fs.rmSync(broken, { recursive: true, force: true });
  }
});

// ---- structured data ----
test('the_home_page_describes_the_site_and_a_free_web_game_in_its_own_language', () => {
  const [en] = ldJson(page('/', 'en'));
  const types = en['@graph'].map((n: any) => n['@type']);
  assert.deepEqual(types, ['WebSite', 'WebApplication']);
  const [site, app] = en['@graph'];
  assert.equal(site.url, 'https://pouleposition.nl/');
  assert.equal(site.inLanguage, 'en');
  assert.equal(site.description, 'Predict the top 10 of every race.');
  assert.equal(app.applicationCategory, 'GameApplication');
  assert.equal(app.isAccessibleForFree, true);
  assert.equal(app.offers.price, '0');
  const [nl] = ldJson(page('/nl', 'en'));
  assert.equal(nl['@graph'][0].url, 'https://pouleposition.nl/nl');
  assert.equal(nl['@graph'][0].inLanguage, 'nl');
  assert.equal(nl['@graph'][0].description, 'Voorspel de top 10 van elke race.');
});

test('other_pages_get_a_web_page_and_a_breadcrumb_to_the_home_page', () => {
  const [ld] = ldJson(page('/nl/rules', 'en'));
  const [webPage, crumbs] = ld['@graph'];
  assert.equal(webPage['@type'], 'WebPage');
  assert.equal(webPage.url, 'https://pouleposition.nl/nl/rules');
  assert.equal(webPage.name, 'Regels en puntentelling – Poule Position');
  assert.equal(webPage.inLanguage, 'nl');
  assert.equal(crumbs['@type'], 'BreadcrumbList');
  assert.deepEqual(crumbs.itemListElement.map((c: any) => [c.position, c.name, c.item]), [
    [1, 'Poule Position', 'https://pouleposition.nl/nl'],
    [2, 'Spelregels', 'https://pouleposition.nl/nl/rules'],
  ]);
});

test('structured_data_points_at_the_canonical_address_even_when_a_visitor_asks_for_dutch_at_an_english_address', () => {
  const html = page('/rules', 'nl'); // the existing head logic: Dutch text, English canonical
  assert.match(html, /<link rel="canonical" href="https:\/\/pouleposition\.nl\/rules"/);
  const [webPage, crumbs] = ldJson(html)[0]['@graph'];
  assert.equal(webPage.url, 'https://pouleposition.nl/rules');
  assert.equal(webPage.inLanguage, 'nl');
  assert.equal(webPage.name, 'Regels en puntentelling – Poule Position');
  assert.equal(crumbs.itemListElement[1].item, 'https://pouleposition.nl/rules');
  assert.equal(crumbs.itemListElement[0].item, 'https://pouleposition.nl/');
});

test('a_faq_becomes_faq_page_data_with_plain_text_answers', () => {
  const [ld] = ldJson(page('/tutorial'));
  const faq = ld['@graph'].find((n: any) => n['@type'] === 'FAQPage');
  assert.equal(faq.mainEntity.length, 2);
  assert.deepEqual(faq.mainEntity[0], { '@type': 'Question', name: 'Does it cost anything?', acceptedAnswer: { '@type': 'Answer', text: 'No. Completely free.' } });
});

test('there_is_exactly_one_structured_data_block_and_it_cannot_close_the_script_early', () => {
  const html = page('/tutorial');
  assert.equal(html.match(/application\/ld\+json/g)!.length, 1, 'the old English block must be replaced, not kept');
  const raw = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1];
  assert.ok(!raw.includes('</'), 'a closing tag inside the data');
  assert.ok(ldJson(html)[0]['@graph'].find((n: any) => n['@type'] === 'FAQPage').mainEntity[1].acceptedAnswer.text.includes('</script><script>'));
});

test('a_page_behind_a_login_keeps_the_original_structured_data_untouched', () => {
  const html = page('/leaderboard');
  assert.equal(html.match(/application\/ld\+json/g)!.length, 1);
});

test('the_link_preview_image_description_is_dutch_on_dutch_pages', () => {
  assert.match(page('/nl/rules'), /<meta property="og:image:alt" content="[^"]*voorspel/i);
  assert.match(page('/rules'), /<meta property="og:image:alt" content="Poule Position logo – predict/);
});

// ---- llms.txt ----
test('llms_txt_is_a_short_index_of_every_public_page_in_both_languages', () => {
  const txt = renderLlmsTxt(content as any);
  const lines = txt.split('\n');
  assert.equal(lines[0], '# Poule Position');
  assert.match(lines[2], /^> Predict the top 10 of every race\./);
  for (const url of ['https://pouleposition.nl/', 'https://pouleposition.nl/rules', 'https://pouleposition.nl/tutorial', 'https://pouleposition.nl/nl', 'https://pouleposition.nl/nl/rules', 'https://pouleposition.nl/nl/tutorial']) {
    assert.ok(txt.includes(`](${url})`), `${url} is not listed`);
  }
  assert.match(txt, /\[Rules and scoring – Poule Position\]\(https:\/\/pouleposition\.nl\/rules\): How points are scored\./);
  assert.match(txt, /\[Regels en puntentelling – Poule Position\]\(https:\/\/pouleposition\.nl\/nl\/rules\): Zo worden punten verdiend\./);
  assert.ok(txt.includes('](https://pouleposition.nl/llms-full.txt)'));
  assert.match(txt, /behind a login/);
  assert.ok(!txt.includes('/auth'), 'the login page is not content');
  assert.ok(!/<[a-z]/i.test(txt), 'no HTML');
});

test('llms_full_txt_has_every_page_as_markdown_in_both_languages_and_no_html', () => {
  const txt = renderLlmsFullTxt(content as any);
  assert.ok(txt.startsWith('# Poule Position'));
  for (const piece of ['## Game Rules', '### Scoring System', '- **Register** with a nickname', '## Spelregels', '### Puntentelling', '**Q: Does it cost anything?**', 'No. **Completely** free.', 'Source: https://pouleposition.nl/rules', 'Source: https://pouleposition.nl/nl/rules']) {
    assert.ok(txt.includes(piece), `llms-full.txt lacks "${piece}"`);
  }
  assert.ok(!txt.includes('Login / Register'), 'the navigation block is not repeated on every page');
  assert.doesNotMatch(txt, /<(main|h[1-3]|ul|li|nav|dl|dt|dd|p|strong|a)[ >]/, 'no markup of ours');
});
