const PrivacyPolicy = () => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="card-f1 p-8">
        <h1 className="text-4xl font-bold mb-6 text-gradient-red">Privacy Policy</h1>

        <p className="text-f1-gray mb-6">
          <strong>Last Updated:</strong> January 30, 2026
        </p>

        <div className="space-y-6 text-f1-gray">
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">1. Introduction</h2>
            <p>
              Welcome to F1 Prediction Poule ("we," "our," or "us"). We are committed to protecting your
              personal information and your right to privacy. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you visit our website and use our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">2. Information We Collect</h2>

            <h3 className="text-xl font-semibold text-f1-pink-500 mb-2">2.1 Personal Information</h3>
            <p className="mb-3">We collect the following personal information that you provide to us:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Email Address:</strong> Used for account authentication</li>
              <li><strong>Nickname:</strong> Your display name on the leaderboard</li>
              <li><strong>Avatar Image:</strong> Optional profile picture (if you choose to upload one)</li>
              <li><strong>Race Predictions:</strong> Your top 10 driver predictions for each race</li>
            </ul>

            <h3 className="text-xl font-semibold text-f1-pink-500 mt-4 mb-2">2.2 Automatically Collected Information</h3>
            <p className="mb-3">When you visit our website, we automatically collect certain information:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Log Data:</strong> IP address, browser type, operating system, referring URLs, and pages visited</li>
              <li><strong>Cookies:</strong> Authentication tokens stored in your browser's local storage</li>
              <li><strong>Usage Data:</strong> How you interact with our website and services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">3. How We Use Your Information</h2>
            <p className="mb-3">We use your information for the following purposes:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Account Management:</strong> Creating and managing your user account</li>
              <li><strong>Authentication:</strong> Verifying your identity via password-based login</li>
              <li><strong>Service Delivery:</strong> Processing and storing your race predictions</li>
              <li><strong>Leaderboard:</strong> Displaying your nickname, avatar, and points on public leaderboards</li>
              <li><strong>Email Communications:</strong> Sending prediction confirmations and race reminders</li>
              <li><strong>Analytics:</strong> Understanding how users interact with our service to improve functionality</li>
              <li><strong>Advertising:</strong> Displaying relevant advertisements through Google AdSense</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">4. Third-Party Services</h2>

            <h3 className="text-xl font-semibold text-f1-pink-500 mb-2">4.1 Google AdSense</h3>
            <p className="mb-3">
              We use Google AdSense to display advertisements on our website. Google AdSense uses cookies
              and web beacons to serve ads based on your prior visits to our website and other websites on
              the Internet. You may opt out of personalized advertising by visiting{' '}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer"
                className="text-f1-pink-500 hover:underline"
              >
                Google Ads Settings
              </a>.
            </p>

            <h3 className="text-xl font-semibold text-f1-pink-500 mb-2">4.2 External APIs</h3>
            <p className="mb-3">We use the following external services to provide Formula 1 data:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>OpenF1 API:</strong> Race schedules, driver information, and race results</li>
              <li><strong>Jolpi Ergast API:</strong> Historical F1 data and statistics</li>
            </ul>

            <h3 className="text-xl font-semibold text-f1-pink-500 mb-2">4.3 Email Service</h3>
            <p>
              We use Gmail/Google Workspace to send transactional emails (prediction confirmations, race results).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">5. Cookies and Tracking Technologies</h2>
            <p className="mb-3">
              We use cookies and similar tracking technologies to track activity on our website and store
              certain information. You can instruct your browser to refuse all cookies or to indicate when
              a cookie is being sent. However, if you do not accept cookies, you may not be able to use
              some portions of our service.
            </p>

            <p className="mb-3"><strong>Types of cookies we use:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Essential Cookies:</strong> Required for authentication and core functionality</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how visitors use our website</li>
              <li><strong>Advertising Cookies:</strong> Used by Google AdSense to display relevant ads</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">6. Data Security</h2>
            <p>
              We implement appropriate technical and organizational security measures to protect your
              personal information. However, no method of transmission over the Internet or electronic
              storage is 100% secure. While we strive to protect your personal information, we cannot
              guarantee its absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">7. Your Privacy Rights</h2>
            <p className="mb-3">Depending on your location, you may have the following rights:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Opt-Out:</strong> Opt out of receiving marketing communications</li>
              <li><strong>Data Portability:</strong> Request a copy of your data in a portable format</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">8. Data Retention</h2>
            <p>
              We retain your personal information only for as long as necessary to fulfill the purposes
              outlined in this Privacy Policy, unless a longer retention period is required or permitted
              by law. When you delete your account, we will delete your personal information from our
              active databases.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">9. Children's Privacy</h2>
            <p>
              Our service is not directed to individuals under the age of 13. We do not knowingly collect
              personal information from children under 13. If you are a parent or guardian and believe
              your child has provided us with personal information, please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">10. International Data Transfers</h2>
            <p>
              Your information may be transferred to and maintained on computers located outside of your
              state, province, country, or other governmental jurisdiction where data protection laws may
              differ. By using our service, you consent to such transfers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">11. Changes to This Privacy Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by
              posting the new Privacy Policy on this page and updating the "Last Updated" date. We
              encourage you to review this Privacy Policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">12. Contact Us</h2>
            <p className="mb-3">
              If you have any questions about this Privacy Policy or our privacy practices, please contact us:
            </p>
            <ul className="list-none ml-4 space-y-1">
              <li><strong>Email:</strong> matt.gloudemans@gmail.com</li>
              <li><strong>Website:</strong> http://localhost:5000</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">13. GDPR Compliance (EU Users)</h2>
            <p className="mb-3">
              If you are located in the European Economic Area (EEA), you have certain data protection rights
              under the General Data Protection Regulation (GDPR):
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>The right to access, update, or delete your personal information</li>
              <li>The right to rectification if your information is inaccurate or incomplete</li>
              <li>The right to object to our processing of your personal information</li>
              <li>The right to request restriction of processing of your personal information</li>
              <li>The right to data portability</li>
              <li>The right to withdraw consent at any time</li>
            </ul>
            <p className="mt-3">
              Our lawful basis for processing your personal information is your consent, which you provide
              when you create an account and use our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">14. California Privacy Rights (CCPA)</h2>
            <p className="mb-3">
              If you are a California resident, you have specific rights regarding your personal information
              under the California Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>The right to know what personal information we collect, use, and disclose</li>
              <li>The right to request deletion of your personal information</li>
              <li>The right to opt out of the sale of your personal information (we do not sell your data)</li>
              <li>The right to non-discrimination for exercising your CCPA rights</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
