// Racing-themed SVG Icons
const ClipboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 inline-block mr-2">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
);

const TrophyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 inline-block mr-2">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M4 22h16"/>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 inline-block mr-2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const TargetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 inline-block mr-2">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);

const CheckeredFlagIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 inline-block mr-2">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
    <line x1="4" y1="22" x2="4" y2="15"/>
    <path d="M8 3v4M12 3v4M16 3v4M8 11v4M12 11v4M16 11v4" strokeWidth="1"/>
  </svg>
);

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 inline-block mr-2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const HelpCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 inline-block mr-2">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const Rules = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-center text-f1-pink-500">Game Rules</h1>

      <div className="space-y-8 text-lg leading-relaxed">
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-pink-500"><ClipboardIcon />How to Play</h2>
          <ol className="list-decimal list-inside space-y-3">
            <li>
              <strong>Register</strong> with your nickname and email (no password required!)
            </li>
            <li>
              <strong>Predict</strong> the top 10 finishing positions for each race using our
              drag-and-drop interface
            </li>
            <li>
              <strong>Submit</strong> your predictions before the deadline (1 minute before race
              start)
            </li>
            <li>
              <strong>Earn points</strong> based on how accurately you predicted the race results
            </li>
            <li>
              <strong>Compete</strong> with other players on the leaderboard throughout the season
            </li>
          </ol>
        </section>

        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-pink-500"><TrophyIcon />Scoring System</h2>
          <p className="mb-4">
            Points are awarded using the official Formula 1 points system for the top 10 finishers:
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-900 p-3 rounded">
              <span className="text-f1-pink-500 font-bold">1st Place:</span> 25 points
            </div>
            <div className="bg-gray-900 p-3 rounded">
              <span className="text-f1-pink-500 font-bold">2nd Place:</span> 18 points
            </div>
            <div className="bg-gray-900 p-3 rounded">
              <span className="text-f1-pink-500 font-bold">3rd Place:</span> 15 points
            </div>
            <div className="bg-gray-900 p-3 rounded">
              <span className="text-f1-pink-500 font-bold">4th Place:</span> 12 points
            </div>
            <div className="bg-gray-900 p-3 rounded">
              <span className="text-f1-pink-500 font-bold">5th Place:</span> 10 points
            </div>
            <div className="bg-gray-900 p-3 rounded">
              <span className="text-f1-pink-500 font-bold">6th Place:</span> 8 points
            </div>
            <div className="bg-gray-900 p-3 rounded">
              <span className="text-f1-pink-500 font-bold">7th Place:</span> 6 points
            </div>
            <div className="bg-gray-900 p-3 rounded">
              <span className="text-f1-pink-500 font-bold">8th Place:</span> 4 points
            </div>
            <div className="bg-gray-900 p-3 rounded">
              <span className="text-f1-pink-500 font-bold">9th Place:</span> 2 points
            </div>
            <div className="bg-gray-900 p-3 rounded">
              <span className="text-f1-pink-500 font-bold">10th Place:</span> 1 point
            </div>
          </div>

          <div className="bg-green-900/30 border border-green-500/50 p-4 rounded-lg mb-2">
            <h3 className="text-lg font-bold text-green-400 mb-2">✓ Exact match</h3>
            <p className="text-sm">
              Predict a driver in the <strong>exact position</strong> they finish → earn the <strong>full points</strong> for that position.
            </p>
            <p className="mt-2 text-sm"><span className="text-green-400">Example:</span> Predict VER P1, finishes P1 → <strong>25 pts</strong></p>
          </div>

          <div className="bg-yellow-900/30 border border-yellow-500/50 p-4 rounded-lg mb-2">
            <h3 className="text-lg font-bold text-yellow-400 mb-2">≈ Near miss (±1 position)</h3>
            <p className="text-sm">
              Predict a driver <strong>one position off</strong> from where they actually finish → earn <strong>half the points</strong> for that position.
            </p>
            <p className="mt-2 text-sm"><span className="text-yellow-400">Example:</span> Predict VER P1, finishes P2 → half of 25 = <strong>13 pts</strong></p>
          </div>

          <div className="bg-gray-900/60 border border-gray-600/50 p-4 rounded-lg mb-4">
            <h3 className="text-lg font-bold text-gray-400 mb-2">✗ Miss (more than 1 off)</h3>
            <p className="text-sm">
              If a driver finishes <strong>more than one position</strong> away from your prediction, or outside the top 10 entirely → <strong>0 points</strong>.
            </p>
            <p className="mt-2 text-sm"><span className="text-gray-400">Example:</span> Predict VER P1, finishes P5 → <strong>0 pts</strong></p>
          </div>

          <p className="text-f1-gray">
            <strong>Note:</strong> Points are based on the position you predicted, not where the driver actually finishes.
            Predicting P1 correctly is worth more than predicting P10 correctly.
          </p>
        </section>

        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-pink-500"><ClockIcon />Prediction Deadlines</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>
              Predictions <strong>must be submitted</strong> at least 1 minute before the race
              starts
            </li>
            <li>You can modify your predictions as many times as you want before the deadline</li>
            <li>
              Once the deadline passes, predictions are <strong>locked</strong> and cannot be
              changed
            </li>
            <li>You'll receive an email confirmation every time you submit or update predictions</li>
          </ul>
        </section>

        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-pink-500"><TargetIcon />Example</h2>
          <p className="mb-4">Let's say you predicted:</p>
          <div className="bg-gray-900 p-4 rounded mb-4">
            <p>P1: Max Verstappen</p>
            <p>P2: Lewis Hamilton</p>
            <p>P3: Charles Leclerc</p>
            <p>... (and 7 more drivers)</p>
          </div>
          <p className="mb-4">And the actual race results are:</p>
          <div className="bg-gray-900 p-4 rounded mb-4">
            <p>P1: Max Verstappen (25 pts)</p>
            <p>P2: Charles Leclerc (18 pts)</p>
            <p>P3: Lando Norris (15 pts)</p>
            <p>P5: Lewis Hamilton (10 pts)</p>
          </div>
          <p className="text-f1-pink-500 font-bold">Your score for this race:</p>
          <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
            <li>
              <strong>Verstappen:</strong> Predicted P1, finished P1 → exact match → <span className="text-green-400">25 pts</span>
            </li>
            <li>
              <strong>Hamilton:</strong> Predicted P2, finished P5 → 3 positions off → <span className="text-gray-400">0 pts</span>
            </li>
            <li>
              <strong>Leclerc:</strong> Predicted P3, finished P2 → near miss → half of 15 = <span className="text-yellow-400">8 pts</span>
            </li>
          </ul>
          <p className="mt-4 font-bold">
            Total: 33 points (plus points from your other 7 predicted drivers)
          </p>
        </section>

        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-pink-500"><span className="inline-block mr-2">🏃</span>Sprint Races</h2>
          <p className="mb-4">
            Some race weekends feature a Sprint race on Saturday in addition to the main Grand Prix on Sunday.
            Sprint races require <strong>separate predictions</strong> for the top 8 positions!
          </p>

          <div className="bg-f1-pink-900/20 border border-f1-pink-500/50 p-4 rounded-lg mb-4">
            <h3 className="text-lg font-bold text-f1-pink-400 mb-2">Sprint Race Points (Top 8)</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-900 p-2 rounded">
                <span className="text-f1-pink-400 font-bold">1st:</span> 8 pts
              </div>
              <div className="bg-gray-900 p-2 rounded">
                <span className="text-f1-pink-400 font-bold">2nd:</span> 7 pts
              </div>
              <div className="bg-gray-900 p-2 rounded">
                <span className="text-f1-pink-400 font-bold">3rd:</span> 6 pts
              </div>
              <div className="bg-gray-900 p-2 rounded">
                <span className="text-f1-pink-400 font-bold">4th:</span> 5 pts
              </div>
              <div className="bg-gray-900 p-2 rounded">
                <span className="text-f1-pink-400 font-bold">5th:</span> 4 pts
              </div>
              <div className="bg-gray-900 p-2 rounded">
                <span className="text-f1-pink-400 font-bold">6th:</span> 3 pts
              </div>
              <div className="bg-gray-900 p-2 rounded">
                <span className="text-f1-pink-400 font-bold">7th:</span> 2 pts
              </div>
              <div className="bg-gray-900 p-2 rounded">
                <span className="text-f1-pink-400 font-bold">8th:</span> 1 pt
              </div>
            </div>
          </div>

          <p className="text-sm text-f1-gray">
            The same scoring rules apply: <strong>exact match = full points</strong>, <strong>near miss (±1) = half points</strong>, anything else = 0.
            Sprint points count toward your overall season total.
          </p>
        </section>

        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-pink-500"><CheckeredFlagIcon />Season Championship</h2>
          <p>
            Your points accumulate throughout the entire 2026 season. The player with the most
            points at the end of the season wins the Players Championship! Check the leaderboard
            regularly to see how you stack up against other players.
          </p>
        </section>

        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-pink-500"><BellIcon />Notifications</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Email confirmation when you register</li>
            <li>Confirmation email every time you submit or update predictions</li>
            <li>Reminder emails before upcoming races (if enabled)</li>
          </ul>
        </section>

        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-pink-500"><CheckeredFlagIcon />Race Results Processing</h2>
          <p className="mb-4">
            Race results are processed in two stages to account for post-race penalties and disqualifications:
          </p>
          <div className="space-y-4">
            <div className="bg-blue-900/30 border border-blue-500/50 p-4 rounded-lg">
              <h3 className="text-lg font-bold text-blue-400 mb-2">Stage 1: Provisional Results (~5 min after race)</h3>
              <p className="text-sm">
                Shortly after the race ends, you'll receive an email with the provisional race results and
                your initial points calculation. This gives you immediate feedback on your predictions!
              </p>
            </div>
            <div className="bg-purple-900/30 border border-purple-500/50 p-4 rounded-lg">
              <h3 className="text-lg font-bold text-purple-400 mb-2">Stage 2: Final Results (24 hours after race)</h3>
              <p className="text-sm">
                24 hours after the race, final points are calculated. This allows time for any
                disqualifications, time penalties, or post-race investigations to be resolved.
                If there are any changes that affect your points, you'll receive an updated email.
              </p>
            </div>
          </div>
          <p className="text-f1-gray mt-4 text-sm">
            <strong>Note:</strong> Your leaderboard position may change after the 24-hour final results
            if disqualifications or penalties are applied.
          </p>
        </section>

        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-pink-500"><HelpCircleIcon />Questions?</h2>
          <p>
            If you have any questions about the rules or how the game works, feel free to contact
            the administrator. Good luck and may the best predictor win! 🏎️
          </p>
        </section>
      </div>
    </div>
  );
};

export default Rules;
