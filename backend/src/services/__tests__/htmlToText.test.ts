import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText } from '../htmlToText';

test('paragraphs_become_separate_blocks_and_br_a_line_break', () => {
  assert.equal(htmlToText('<p>Hello Kimi!</p><p>Line one<br>line two</p>'), 'Hello Kimi!\n\nLine one\nline two');
});

test('a_link_keeps_its_address_after_the_text', () => {
  assert.equal(
    htmlToText('<p><a href="https://pouleposition.nl/predictions" style="x">Make your prediction</a></p>'),
    'Make your prediction (https://pouleposition.nl/predictions)'
  );
});

test('a_link_whose_text_is_the_address_is_not_repeated', () => {
  assert.equal(htmlToText('<a href="https://www.pouleposition.nl">www.pouleposition.nl</a>'), 'www.pouleposition.nl');
  assert.equal(htmlToText('<a href="https://www.pouleposition.nl/">https://www.pouleposition.nl</a>'), 'https://www.pouleposition.nl');
});

test('head_style_script_comments_and_images_leave_no_trace', () => {
  const html = `<!DOCTYPE html><html><head><title>Poule Position</title><style>.a{color:red}</style></head>
    <body><!-- note --><script>alert(1)</script><img src="https://x.test/a.png" alt="Poule Position"><p>Body</p></body></html>`;
  assert.equal(htmlToText(html), 'Body');
});

test('hidden_blocks_are_left_out_so_spoilers_stay_in_the_mail_app_that_hides_them', () => {
  const html = `
    <div style="display: none; font-size: 1px;">Preview text&zwnj;&nbsp;&zwnj;&nbsp;</div>
    <p>Visible</p>
    <div class="sp-content" style="display: none;"><table><tr><td>1</td><td>Verstappen</td></tr><tr><td>2</td><td>Norris</td></tr></table></div>
    <p>After</p>`;
  const t = htmlToText(html);
  assert.equal(t, 'Visible\n\nAfter');
  assert.ok(!t.includes('Verstappen'), 'the hidden result leaked into the plain text');
});

test('table_cells_share_a_line_and_rows_get_their_own', () => {
  const html = '<table><tr><td>Fri</td><td>01:30</td><td>Practice 1</td></tr><tr><td></td><td>05:00</td><td>Practice 2</td></tr></table>';
  assert.equal(htmlToText(html), 'Fri 01:30 Practice 1\n05:00 Practice 2');
});

test('list_items_get_a_dash', () => {
  assert.equal(htmlToText('<ul><li>One</li><li>Two <strong>bold</strong></li></ul>'), '- One\n- Two bold');
});

test('entities_are_decoded_and_non_breaking_spaces_become_spaces', () => {
  assert.equal(htmlToText('<p>Tom &amp; Jerry &lt;3 &quot;quoted&quot; &#39;x&#39; 6.201&nbsp;km 50&#160;laps &middot; done &#x2713;</p>'), 'Tom & Jerry <3 "quoted" \'x\' 6.201 km 50 laps · done ✓');
});

test('whitespace_and_blank_lines_are_tidied', () => {
  assert.equal(htmlToText('<div>\n   <p>  Spaced    out  </p>\n\n\n\n<p>&nbsp;</p><p>&nbsp;</p><p>Next</p></div>'), 'Spaced out\n\nNext');
});

test('no_tags_are_left_in_the_result', () => {
  const t = htmlToText('<table role="presentation"><tr><td bgcolor="#fff" style="a:b"><h2 style="x">Title</h2><p class="c">Text <em>em</em></p></td></tr></table>');
  assert.ok(!/<[a-z/]/i.test(t), t);
  assert.equal(t, 'Title\n\nText em');
});
