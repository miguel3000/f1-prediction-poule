// One-off script to send a sample of every email template to a single address,
// so the new logo/brand-color redesign can be eyeballed in a real inbox.
// Usage (inside the container): node dist/scripts/sendTestEmails.js you@example.com [en|nl]
import dotenv from 'dotenv';
dotenv.config();

import {
  sendPredictionConfirmation,
  sendProvisionalResults,
  sendFinalResults,
  sendRaceReminder,
  sendMissedPredictionReminder,
  sendAutoFillNotice,
  sendPasswordReset,
  sendResultsAreInEmail,
  sendPersonalRaceResults,
  sendBroadcastEmail,
  sendAdminAlert,
  RaceResultForEmail,
  UserPredictionResult,
  PersonalPredictionPosition,
} from '../services/emailService';

const raceResults: RaceResultForEmail[] = [
  { position: 1, driverName: 'Russell', points: 25 },
  { position: 2, driverName: 'Verstappen', points: 18 },
  { position: 3, driverName: 'Leclerc', points: 15 },
  { position: 4, driverName: 'Piastri', points: 12 },
  { position: 5, driverName: 'Norris', points: 10 },
];

const userPrediction: UserPredictionResult[] = [
  { predictedPosition: 1, driverName: 'Russell', team: 'Mercedes', actualPosition: 1, pointsEarned: 25, hasBonus: false },
  { predictedPosition: 2, driverName: 'Leclerc', team: 'Ferrari', actualPosition: 3, pointsEarned: 9, hasBonus: true },
  { predictedPosition: 3, driverName: 'Verstappen', team: 'Red Bull Racing', actualPosition: 2, pointsEarned: 7, hasBonus: true },
  { predictedPosition: 4, driverName: 'Norris', team: 'McLaren', actualPosition: null, pointsEarned: 0, hasBonus: false },
];

const personalPredictions: PersonalPredictionPosition[] = [
  { position: 1, driverName: 'Russell' },
  { position: 2, driverName: 'Leclerc' },
  { position: 3, driverName: 'Verstappen' },
];

const personalActuals: PersonalPredictionPosition[] = [
  { position: 1, driverName: 'Russell' },
  { position: 2, driverName: 'Verstappen' },
  { position: 3, driverName: 'Leclerc' },
];

const run = async () => {
  const to = process.argv[2];
  if (!to) {
    console.error('Usage: node dist/scripts/sendTestEmails.js you@example.com');
    process.exit(1);
  }

  const lang = process.argv[3] === 'nl' ? 'nl' : 'en';
  console.log('Sending test emails to', to, `(${lang})`);

  await sendPredictionConfirmation(to, 'Gaston', 'Azerbaijan Grand Prix', [
    { driverName: 'Russell', team: 'Mercedes' },
    { driverName: 'Verstappen', team: 'Red Bull Racing' },
    { driverName: 'Leclerc', team: 'Ferrari' },
    { driverName: 'Piastri', team: 'McLaren' },
    { driverName: 'Norris', team: 'McLaren' },
  ], 'Verstappen', lang);
  console.log('1/11 sent: prediction confirmation');

  await sendProvisionalResults(to, 'Gaston', 'Azerbaijan Grand Prix', raceResults, userPrediction, 41, lang);
  console.log('2/11 sent: provisional results');

  await sendFinalResults(to, 'Gaston', 'Azerbaijan Grand Prix', 41, true, 34, userPrediction, lang);
  console.log('3/11 sent: final results');

  await sendRaceReminder(to, 'Gaston', 'Singapore Grand Prix', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), lang);
  console.log('4/11 sent: race reminder');

  await sendMissedPredictionReminder(to, 'Gaston', 'Singapore Grand Prix', false, lang);
  console.log('5/11 sent: missed-prediction reminder');

  await sendAutoFillNotice(to, 'Gaston', 'Singapore Grand Prix', [
    { driverName: 'Russell', team: 'Mercedes' },
    { driverName: 'Verstappen', team: 'Red Bull Racing' },
    { driverName: 'Leclerc', team: 'Ferrari' },
    { driverName: 'Piastri', team: 'McLaren' },
    { driverName: 'Norris', team: 'McLaren' },
  ], lang);
  console.log('6/11 sent: auto-fill notice');

  await sendResultsAreInEmail(to, 'Gaston', 'Azerbaijan Grand Prix', lang);
  console.log('7/11 sent: results are in');

  await sendPersonalRaceResults(to, 'Gaston', 'Azerbaijan Grand Prix', 'main', personalPredictions, personalActuals, 41, 187, lang);
  console.log('8/11 sent: personal race results (main)');

  await sendPersonalRaceResults(to, 'Gaston', 'Azerbaijan Sprint', 'sprint', personalPredictions, personalActuals, 19, 187, lang);
  console.log('9/11 sent: personal race results (sprint)');

  await sendBroadcastEmail(to, 'Gaston', 'Test Broadcast', 'This is a test of the broadcast email template.\nSecond line to check line breaks.', undefined, lang);
  console.log('10/11 sent: broadcast');

  await sendAdminAlert('Test admin alert', 'This is a test of the admin ops-alert template.');
  console.log('11/12 sent: admin alert (goes to ADMIN_EMAIL, not the address above)');

  await sendPasswordReset(to, 'Gaston', `${process.env.FRONTEND_URL}/reset-password?token=EXAMPLE-NOT-A-REAL-TOKEN`, lang);
  console.log('12/12 sent: password reset (sample link, not a real token)');

  console.log('Done.');
  process.exit(0);
};

run();
