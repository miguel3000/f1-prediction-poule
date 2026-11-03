import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { format } from 'util';
import { getQualifyingResults, getRaceResults } from '../openF1Service';

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
