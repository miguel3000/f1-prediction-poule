const PrivacyPolicy = () => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="card-f1 p-8">
        <h1 className="text-4xl font-bold mb-6 text-f1-yellow-500">Privacy Policy</h1>

        <p className="text-white mb-6">
          <strong>Last Updated:</strong> September 29, 2026
        </p>

        <div className="space-y-6 text-white">
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">1. Introduction</h2>
            <p>
              Poule Position is a small, self-hosted Formula 1 prediction game. This page explains what
              information we collect from you, what we use it for, and who else — if anyone — it's shared
              with. We keep this simple on purpose: we only collect what the game itself needs to run.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">2. Information We Collect</h2>

            <h3 className="text-xl font-semibold text-f1-yellow-500 mb-2">2.1 What you give us</h3>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Email Address:</strong> Used to log in and to send you prediction/result emails</li>
              <li><strong>Password:</strong> Stored as a one-way hash — we never see or store it in plain text</li>
              <li><strong>Nickname:</strong> Your display name on the leaderboard</li>
              <li><strong>Avatar Image:</strong> Optional profile picture, if you choose to upload one</li>
              <li><strong>Race Predictions:</strong> Your finishing-order picks for each race and sprint</li>
            </ul>

            <h3 className="text-xl font-semibold text-f1-yellow-500 mt-4 mb-2">2.2 What we don't collect</h3>
            <p>
              We don't run any analytics, tracking, or advertising scripts, and we don't use cookies.
              Your session stays signed in via a login token stored in your browser's local storage, which
              never leaves your device except to authenticate your own requests to our server.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Account & Login:</strong> Creating your account and verifying it's you when you sign in</li>
              <li><strong>Predictions & Scoring:</strong> Storing your picks and calculating your points after each race</li>
              <li><strong>Leaderboard:</strong> Showing your nickname, avatar, and points to other players</li>
              <li><strong>Email:</strong> Sending prediction confirmations, results, and reminders about upcoming races</li>
            </ul>
            <p className="mt-3">
              We do not sell, rent, or share your information with advertisers — there are none. We don't
              run ads on this site.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">4. Third-Party Services</h2>

            <h3 className="text-xl font-semibold text-f1-yellow-500 mb-2">4.1 Race Data</h3>
            <p className="mb-3">
              We pull public Formula 1 schedule, driver, and results data from the OpenF1 API and the
              Jolpi/Ergast API. No personal information about you is sent to these services — we only
              fetch general race data from them.
            </p>

            <h3 className="text-xl font-semibold text-f1-yellow-500 mb-2">4.2 Email Delivery</h3>
            <p>
              Emails are sent through our own mail servers. The content is the transactional messages
              described above — we don't use any marketing or mailing-list tooling.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">5. Where Your Data Lives</h2>
            <p>
              Poule Position runs on our own self-hosted server rather than a large third-party cloud
              platform. Your account data, predictions, and any avatar you upload are stored in our
              database and file storage on that server, located in the Netherlands.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">6. Data Security</h2>
            <p>
              Passwords are hashed before storage, admin functions require a separate authorization check,
              and the database is not directly reachable from outside our server. That said, no method of
              transmission or storage is 100% secure, and we can't guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">7. Your Rights</h2>
            <p className="mb-3">
              Since Poule Position is based in the Netherlands and serves an EU audience, you have the
              following rights under the GDPR:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Access:</strong> Ask what information we hold about you</li>
              <li><strong>Correction:</strong> Ask us to fix inaccurate information (or just edit your profile)</li>
              <li><strong>Deletion:</strong> Ask us to delete your account and everything tied to it</li>
              <li><strong>Data Portability:</strong> Ask for a copy of your data in a portable format</li>
            </ul>
            <p className="mt-3">
              To exercise any of these, contact us using the details in section 9. When you delete your
              account, we delete your personal information from our active database.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">8. Children's Privacy</h2>
            <p>
              This service is not directed at children under 13, and we do not knowingly collect
              information from them.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">9. Contact Us</h2>
            <p className="mb-3">Questions about this policy or your data? Reach us at:</p>
            <ul className="list-none ml-4 space-y-1">
              <li><strong>Email:</strong> noreply@pouleposition.nl</li>
              <li><strong>Website:</strong> https://pouleposition.nl</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">10. Changes to This Policy</h2>
            <p>
              If this policy changes, we'll update the "Last Updated" date above. Since this is a small,
              actively developed project, check back occasionally.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
