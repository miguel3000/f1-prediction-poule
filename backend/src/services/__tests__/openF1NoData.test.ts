import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { format } from 'util';
import {
  getQualifyingResults,
  getRaceResults,
  getMeetings,
  getSessions,
  getDrivers,
  getSessionResults,
  findSessionKey,
  getLatestDrivers,
} from '../openF1Service';

// OpenF1 answers a query with no rows (a session that has not run yet, or has no data yet) with
// HTTP 404 {"detail":"No results found."}. That is "nothing yet", not a failure to shout about.

const realGet = axios.get;
const realError = console.error;
afterEach(() => {
  (axios as any).get = realGet;
  console.error = realError;
});

const failWith = (status: number) => {
  (axios as any).get = async () => {
    throw Object.assign(new Error(`Request failed with status code ${status}`), {
      isAxiosError: true,
      response: { status, data: { detail: 'No results found.' } },
      config: { headers: { Authorization: 'must-not-be-logged' } },
    });
  };
};
const captureErrors = () => {
  const lines: string[] = [];
  // format() is what console.error prints, including an Error's stack and own properties
  console.error = (...args: unknown[]) => {
    lines.push(format(...args));
  };
  return lines;
};

test('qualifying_with_no_data_yet_is_empty_and_not_an_error', async () => {
  failWith(404);
  const logged = captureErrors();
  assert.deepEqual(await getQualifyingResults(11999), []);
  assert.deepEqual(logged, []);
});

test('race_results_with_no_data_yet_are_empty_and_not_an_error', async () => {
  failWith(404);
  const logged = captureErrors();
  assert.deepEqual(await getRaceResults(11998), []);
  assert.deepEqual(logged, []);
});

test('a_real_failure_is_still_logged_as_one_short_line_without_the_request_dump', async () => {
  failWith(500);
  const logged = captureErrors();
  assert.deepEqual(await getQualifyingResults(11997), []);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /qualifying results from OpenF1/);
  assert.match(logged[0], /status code 500/);
  assert.doesNotMatch(logged[0], /\n/, 'one line, not a stack trace');
  assert.doesNotMatch(logged[0], /must-not-be-logged|isAxiosError/, 'the request config stays out of the log');
});

// These four hand the failure to their caller (the results cross-check reports a source as
// unavailable from it), so only the logging changes: they still reject.
const rethrowing: Array<[string, () => Promise<unknown>, RegExp]> = [
  ['meetings', () => getMeetings(2026), /meetings/],
  ['sessions', () => getSessions(1), /sessions/],
  ['drivers', () => getDrivers(1), /drivers/],
  ['session_results', () => getSessionResults(1), /session results/],
];
for (const [name, call, what] of rethrowing) {
  test(`${name}_with_no_data_yet_still_rejects_but_logs_nothing`, async () => {
    failWith(404);
    const logged = captureErrors();
    await assert.rejects(call, /status code 404/);
    assert.deepEqual(logged, []);
  });

  test(`${name}_failing_still_rejects_and_logs_one_short_line`, async () => {
    failWith(500);
    const logged = captureErrors();
    await assert.rejects(call, /status code 500/);
    assert.equal(logged.length, 1);
    assert.match(logged[0], what);
    assert.match(logged[0], /status code 500/);
    assert.doesNotMatch(logged[0], /\n/, 'one line, not a stack trace');
    assert.doesNotMatch(logged[0], /must-not-be-logged|isAxiosError/, 'the request config stays out of the log');
  });
}

test('session_key_lookup_with_no_data_yet_finds_nothing_and_logs_nothing', async () => {
  failWith(404);
  const logged = captureErrors();
  assert.equal(await findSessionKey(2026, 'Qualifying', '2026-11-04T20:00:00Z'), null);
  assert.deepEqual(logged, []);
});

test('session_key_lookup_failing_finds_nothing_and_logs_one_short_line', async () => {
  failWith(500);
  const logged = captureErrors();
  assert.equal(await findSessionKey(2026, 'Qualifying', '2026-11-05T20:00:00Z'), null);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /session key for Qualifying/);
  assert.doesNotMatch(logged[0], /\n/, 'one line, not a stack trace');
  assert.doesNotMatch(logged[0], /must-not-be-logged|isAxiosError/);
});

test('latest_drivers_with_no_data_yet_is_empty_and_logs_nothing', async () => {
  failWith(404);
  const logged = captureErrors();
  assert.deepEqual(await getLatestDrivers(2026), []);
  assert.deepEqual(logged, []);
});

test('latest_drivers_failing_is_empty_and_logs_only_short_lines', async () => {
  failWith(500);
  const logged = captureErrors();
  assert.deepEqual(await getLatestDrivers(2026), []);
  assert.ok(logged.length >= 1);
  for (const line of logged) {
    assert.doesNotMatch(line, /\n/, 'one line, not a stack trace');
    assert.doesNotMatch(line, /must-not-be-logged|isAxiosError/);
  }
});
