import { sendPersonalRaceResults } from '../services/emailService';

async function main() {
  const recipient = process.argv[2] || 'claude@miguelm.nl';

  const predictions = [
    { position: 1, driverName: 'Max Verstappen' },
    { position: 2, driverName: 'Charles Leclerc' },
    { position: 3, driverName: 'Lando Norris' },
    { position: 4, driverName: 'Carlos Sainz' },
    { position: 5, driverName: 'Lewis Hamilton' },
    { position: 6, driverName: 'George Russell' },
    { position: 7, driverName: 'Fernando Alonso' },
    { position: 8, driverName: 'Oscar Piastri' },
    { position: 9, driverName: 'Lance Stroll' },
    { position: 10, driverName: 'Esteban Ocon' },
  ];

  const actuals = [
    { position: 1, driverName: 'Charles Leclerc' },
    { position: 2, driverName: 'Carlos Sainz' },
    { position: 3, driverName: 'Max Verstappen' },
    { position: 4, driverName: 'Lando Norris' },
    { position: 5, driverName: 'George Russell' },
    { position: 6, driverName: 'Lewis Hamilton' },
    { position: 7, driverName: 'Oscar Piastri' },
    { position: 8, driverName: 'Fernando Alonso' },
    { position: 9, driverName: 'Esteban Ocon' },
    { position: 10, driverName: 'Lance Stroll' },
  ];

  console.log(`Sending test email to: ${recipient}`);

  const success = await sendPersonalRaceResults(
    recipient,
    'TestUser',
    'Monaco Grand Prix',
    'main',
    predictions,
    actuals,
    42,
    187
  );

  console.log(success ? 'Email sent successfully!' : 'Failed to send email.');
  process.exit(success ? 0 : 1);
}

main();
