const About = () => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="card-f1 p-8">
        <h1 className="text-4xl font-bold mb-6 text-gradient-red">About F1 Prediction Poule</h1>

        <div className="space-y-6 text-f1-gray">
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Welcome to F1 Prediction Poule</h2>
            <p>
              F1 Prediction Poule is a fun and competitive Formula 1 prediction game where racing enthusiasts
              can test their knowledge of the sport by predicting race results and competing against friends
              and fellow fans on a global leaderboard.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">What We Do</h2>
            <p className="mb-3">
              Our platform allows you to:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>
                <strong className="text-white">Make Predictions:</strong> Predict the top 10 finishing positions
                for every Formula 1 race in the season using our intuitive drag-and-drop interface
              </li>
              <li>
                <strong className="text-white">Earn Points:</strong> Score points based on the official F1 points
                system (25-18-15-12-10-8-6-4-2-1) when your predictions match the actual race results
              </li>
              <li>
                <strong className="text-white">Compete on Leaderboards:</strong> See how you stack up against
                other players with our live leaderboard featuring a podium display for the top 3 users
              </li>
              <li>
                <strong className="text-white">Track Driver Standings:</strong> Stay updated with real-time
                Formula 1 driver championship standings
              </li>
              <li>
                <strong className="text-white">View Race Calendar:</strong> Access the complete 2026 F1 race
                schedule with results and upcoming events
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">How It Works</h2>
            <div className="space-y-4">
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h3 className="text-lg font-bold text-f1-pink-500 mb-2">1. Create Your Account</h3>
                <p>
                  Sign up with your email address, choose a nickname, and set a password to get started.
                </p>
              </div>

              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h3 className="text-lg font-bold text-f1-pink-500 mb-2">2. Make Your Predictions</h3>
                <p>
                  Before each race, drag and drop drivers to predict the top 10 finishing positions. You can
                  modify your predictions anytime until 1 minute before the race starts.
                </p>
              </div>

              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h3 className="text-lg font-bold text-f1-pink-500 mb-2">3. Watch the Race</h3>
                <p>
                  Enjoy the Grand Prix and see how your predictions compare to the actual race results!
                </p>
              </div>

              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h3 className="text-lg font-bold text-f1-pink-500 mb-2">4. Earn Points</h3>
                <p>
                  After the race, points are automatically calculated based on correct predictions using the
                  official F1 scoring system. Your total score is updated on the leaderboard.
                </p>
              </div>

              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h3 className="text-lg font-bold text-f1-pink-500 mb-2">5. Climb the Leaderboard</h3>
                <p>
                  Compete throughout the season to reach the podium and claim your place among the top
                  predictors!
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Our Mission</h2>
            <p>
              Our mission is to enhance the Formula 1 viewing experience by providing an engaging platform
              where fans can demonstrate their racing knowledge, compete with friends, and connect with a
              global community of F1 enthusiasts. We believe that prediction games add an extra layer of
              excitement to every race weekend.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Technology & Data</h2>
            <p className="mb-3">
              F1 Prediction Poule is built with modern web technologies to provide a fast, responsive, and
              reliable experience:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Real-time Data:</strong> We integrate with official F1 data sources (OpenF1 API and Jolpi Ergast API) to provide accurate race schedules, driver information, and results</li>
              <li><strong>Secure Authentication:</strong> Password-based authentication keeps your account secure</li>
              <li><strong>Mobile-Friendly:</strong> Our responsive design works seamlessly on desktop, tablet, and mobile devices</li>
              <li><strong>Fast Performance:</strong> Built with React, TypeScript, and modern web technologies for optimal speed</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Fair Play & Rules</h2>
            <p className="mb-3">
              We are committed to providing a fair and transparent prediction game:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Predictions lock 1 minute before each race starts - no last-second changes</li>
              <li>Points are calculated automatically using the official F1 scoring system</li>
              <li>All users compete on equal terms with the same rules and scoring</li>
              <li>Race results are updated from official F1 data sources</li>
            </ul>
            <p className="mt-3">
              For complete game rules and scoring details, visit our <a href="/rules" className="text-f1-pink-500 hover:underline">Rules page</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Community</h2>
            <p>
              F1 Prediction Poule is designed for Formula 1 fans by Formula 1 fans. Whether you're a casual
              viewer or a die-hard supporter, our platform welcomes all levels of F1 knowledge. Join our
              growing community and prove you have what it takes to be the ultimate F1 predictor!
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Free to Play</h2>
            <p>
              F1 Prediction Poule is completely free to use. We support the platform through non-intrusive
              advertisements to keep the service free for all users. Your support by using our platform helps
              us continue providing this service to the F1 community.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Disclaimer</h2>
            <p className="mb-3">
              F1 Prediction Poule is an independent fan-created prediction game and is not affiliated with,
              endorsed by, or connected to:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Formula 1® (F1)</li>
              <li>Fédération Internationale de l'Automobile (FIA)</li>
              <li>Liberty Media Corporation</li>
              <li>Any Formula 1 teams or drivers</li>
            </ul>
            <p className="mt-3">
              All trademarks, logos, and brand names are the property of their respective owners. Formula 1,
              F1, and related marks are trademarks of Formula One Licensing BV. We use race data and driver
              information for informational and entertainment purposes only.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Contact Us</h2>
            <p className="mb-3">
              We'd love to hear from you! Whether you have questions, feedback, or need support:
            </p>
            <ul className="list-none ml-4 space-y-1">
              <li><strong>Email:</strong> <a href="mailto:matt.gloudemans@gmail.com" className="text-f1-pink-500 hover:underline">matt.gloudemans@gmail.com</a></li>
              <li><strong>Website:</strong> http://localhost:5000</li>
            </ul>
            <p className="mt-3">
              For privacy-related inquiries, please see our <a href="/privacy" className="text-f1-pink-500 hover:underline">Privacy Policy</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Version & Updates</h2>
            <p>
              <strong>Current Version:</strong> 2.0 (2026 Season)<br />
              <strong>Last Updated:</strong> January 30, 2026
            </p>
            <p className="mt-3">
              We continuously improve F1 Prediction Poule based on user feedback and the latest Formula 1
              developments. Check back regularly for new features and enhancements!
            </p>
          </section>

          <div className="mt-8 pt-6 border-t border-gray-700 text-center">
            <p className="text-lg font-semibold text-white mb-2">Ready to Start Predicting?</p>
            <p className="mb-4">Join thousands of F1 fans competing for leaderboard glory!</p>
            <a
              href="/"
              className="inline-block bg-f1-pink-500 hover:bg-f1-pink-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Go to Homepage
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
