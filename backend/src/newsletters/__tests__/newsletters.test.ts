import test from 'node:test';
import assert from 'node:assert/strict';
import { newsletters, getNewsletter } from '../index';
import { renderNewsletter } from '../../services/emailService';

// What the player sees in the phone menu drawer (frontend/src/components/Navigation.tsx), by language.
// The "did you know" tour has to name every one of them, spelled as the site spells it.
const DRAWER = {
  en: ['Home', 'Race Overview', 'Drivers', 'Teams', 'Championship', 'Groups', 'My Predictions', 'Statistics', 'News',
    'Live Timing', 'Pit Wall', 'How to Play', 'FAQ', 'Rules', 'About', 'Privacy Policy'],
  nl: ['Home', 'Raceoverzicht', 'Coureurs', 'Teams', 'Kampioenschap', 'Groepen', 'Mijn voorspellingen', 'Statistieken', 'Nieuws',
    'Live tijden', 'Pit Wall', 'Zo speel je', 'FAQ', 'Regels', 'Over', 'Privacybeleid'],
};

const allText = (content: { subject: string; banner: string; intro: string; closing: string; sections: any[]; callout: any }) => [
  content.subject, content.banner, content.intro, content.closing,
  content.callout.title, ...content.callout.paragraphs, content.callout.button, content.callout.mailSubject,
  ...content.sections.flatMap((s) => [s.title, ...s.items.flatMap((i: any) => [i.title, i.text])]),
];

test('the_registry_lists_both_newsletters_and_an_unknown_name_names_the_choices', () => {
  assert.ok(newsletters['whats-new-oct-2026']);
  assert.ok(newsletters['did-you-know-nov-2026']);
  assert.equal(getNewsletter('did-you-know-nov-2026'), newsletters['did-you-know-nov-2026']);
  assert.throws(() => getNewsletter('nope'), /whats-new-oct-2026.*did-you-know-nov-2026|did-you-know-nov-2026.*whats-new-oct-2026/);
  assert.throws(() => getNewsletter(undefined), /Choose a newsletter/);
});

for (const [name, newsletter] of Object.entries(newsletters)) {
  test(`${name}_has_the_same_shape_in_english_and_dutch_with_no_empty_text`, () => {
    assert.equal(newsletter.en.sections.length, newsletter.nl.sections.length);
    newsletter.en.sections.forEach((section, i) => {
      assert.equal(section.items.length, newsletter.nl.sections[i].items.length, `section ${i} has the same number of items`);
    });
    assert.equal(newsletter.en.callout.paragraphs.length, newsletter.nl.callout.paragraphs.length);
    for (const lang of ['en', 'nl'] as const) {
      for (const text of allText(newsletter[lang])) {
        assert.ok(typeof text === 'string' && text.trim().length > 0, `${lang}: no empty text`);
      }
    }
  });

  test(`${name}_never_uses_an_em_dash`, () => {
    for (const lang of ['en', 'nl'] as const) {
      for (const text of allText(newsletter[lang])) {
        assert.doesNotMatch(text, /—/, `${lang}: "${text.slice(0, 40)}..." has an em dash`);
      }
    }
  });

  test(`${name}_renders_a_short_subject_and_every_item_in_both_languages`, () => {
    for (const lang of ['en', 'nl'] as const) {
      const mail = renderNewsletter(newsletter[lang], 'Tester', lang, 'https://example.invalid/unsub');
      assert.ok(mail.subject.length > 0 && mail.subject.length <= 200);
      assert.doesNotMatch(mail.subject, /[\r\n]/);
      for (const section of newsletter[lang].sections) {
        for (const item of section.items) {
          const escaped = item.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          assert.ok(mail.html.includes(escaped), `${lang}: "${item.title}" is in the mail`);
        }
      }
    }
  });
}

test('the_did_you_know_tour_names_every_menu_item_exactly_as_the_site_spells_it', () => {
  for (const lang of ['en', 'nl'] as const) {
    const titles = newsletters['did-you-know-nov-2026'][lang].sections.flatMap((s) => s.items.map((i) => i.title));
    for (const label of DRAWER[lang]) {
      assert.ok(titles.includes(label), `${lang}: the tour has an item titled "${label}"`);
    }
  }
});

test('the_did_you_know_tour_explains_the_top_bar_and_leaves_out_the_bar_that_was_removed', () => {
  for (const lang of ['en', 'nl'] as const) {
    const text = allText(newsletters['did-you-know-nov-2026'][lang]).join('\n');
    assert.doesNotMatch(text, /bottom (bar|row)|onderbalk|onderste balk|onderaan het scherm/i, `${lang}: no mention of the removed bottom bar`);
  }
});
