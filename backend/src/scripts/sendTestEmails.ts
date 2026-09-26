// One-off script to send a sample of every email template to a single address,
// so the new logo/brand-color redesign can be eyeballed in a real inbox.
// Usage (inside the container): node dist/scripts/sendTestEmails.js you@example.com
import dotenv from 'dotenv';
dotenv.config();

import {
  sendPredictionConfirmation,
  sendProvisionalResults,
  sendFinalResults,
  sendRaceReminder,
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
  { predictedPosition: 1, driverName: 'Russell', actualPosition: 1, pointsEarned: 25, hasBonus: false },
  { predictedPosition: 2, driverName: 'Leclerc', actualPosition: 3, pointsEarned: 9, hasBonus: true },
  { predictedPosition: 3, driverName: 'Verstappen', actualPosition: 2, pointsEarned: 7, hasBonus: true },
  { predictedPosition: 4, driverName: 'Norris', actualPosition: null, pointsEarned: 0, hasBonus: false },
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

  console.log('Sending test emails to', to);

  await sendPredictionConfirmation(to, 'Gaston', 'Azerbaijan Grand Prix', ['Russell', 'Verstappen', 'Leclerc', 'Piastri', 'Norris']);
  console.log('1/8 sent: prediction confirmation');

  await sendProvisionalResults(to, 'Gaston', 'Azerbaijan Grand Prix', raceResults, userPrediction, 41);
  console.log('2/8 sent: provisional results');

  await sendFinalResults(to, 'Gaston', 'Azerbaijan Grand Prix', 41, true, 34, userPrediction);
  console.log('3/8 sent: final results');

  await sendRaceReminder(to, 'Gaston', 'Singapore Grand Prix', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
  console.log('4/8 sent: race reminder');

  await sendResultsAreInEmail(to, 'Gaston', 'Azerbaijan Grand Prix');
  console.log('5/8 sent: results are in');

  await sendPersonalRaceResults(to, 'Gaston', 'Azerbaijan Grand Prix', 'main', personalPredictions, personalActuals, 41, 187);
  console.log('6/8 sent: personal race results (main)');

  await sendPersonalRaceResults(to, 'Gaston', 'Azerbaijan Sprint', 'sprint', personalPredictions, personalActuals, 19, 187);
  console.log('7/8 sent: personal race results (sprint)');

  await sendBroadcastEmail(to, 'Gaston', 'Test Broadcast', 'This is a test of the broadcast email template.\nSecond line to check line breaks.');
  console.log('8/8 sent: broadcast');

  await sendAdminAlert('Test admin alert', 'This is a test of the admin ops-alert template.');
  console.log('9/9 sent: admin alert (goes to ADMIN_EMAIL, not the address above)');

  console.log('Done.');
  process.exit(0);
};

run();
