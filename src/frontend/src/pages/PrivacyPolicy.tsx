import { Link } from "@tanstack/react-router";

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-foreground">
      <h1 className="text-3xl font-bold mb-2 text-primary">Privacy Policy</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Last updated:{" "}
        {new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>

      {/* Risk Disclaimer */}
      <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-6 mb-8">
        <h2 className="text-xl font-extrabold text-red-400 uppercase tracking-wide mb-3">
          ⚠️ Risk Disclaimer
        </h2>
        <p className="text-red-200 font-semibold leading-relaxed">
          Alpha Signal AI is provided{" "}
          <strong>
            strictly for educational and technical analysis purposes only
          </strong>
          . All signals, indicators, and market data displayed on this platform
          do <strong>not</strong> constitute financial advice, investment
          recommendations, or solicitation to buy or sell any asset. Trading
          cryptocurrencies, forex, commodities, and other financial instruments
          involves substantial risk of loss and is not suitable for every
          investor. Past performance of any signals or analysis does not
          guarantee future results. You are solely responsible for your own
          trading decisions. Always consult a qualified financial professional
          before making any investment decision.
        </p>
      </div>

      {/* Sections */}
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3 border-b border-border pb-2">
          1. Information We Collect
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Alpha Signal AI does not require account registration and does not
          collect personally identifiable information by default. If you
          interact with admin features, session data may be stored locally on
          your device (localStorage). We do not collect names, email addresses,
          or payment information unless explicitly provided through optional
          features.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3 border-b border-border pb-2">
          2. How We Use Information
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Any data processed by the application is used solely to provide market
          analytics, signal display, and educational content. We do not sell,
          share, or transfer any user data to third parties.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3 border-b border-border pb-2">
          3. Third-Party Services
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Alpha Signal AI integrates with the following third-party services for
          market data and AI analysis:
        </p>
        <ul className="list-disc list-inside mt-3 space-y-1 text-muted-foreground">
          <li>Binance API — for real-time cryptocurrency market data</li>
          <li>
            Google Gemini AI — for AI-powered market research and analysis
          </li>
          <li>TradingView — for advanced charting widgets</li>
          <li>Financial Modeling Prep — for macroeconomic calendar data</li>
          <li>YouTube — for embedded educational video content</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-3">
          Each of these services operates under their own privacy policies and
          terms of service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3 border-b border-border pb-2">
          4. Cookies & Local Storage
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          This application may store preference data and session tokens in your
          browser's localStorage to maintain settings across sessions. No
          tracking cookies are used for advertising purposes.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3 border-b border-border pb-2">
          5. Children's Privacy
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          This application is intended for adults only. We do not knowingly
          collect information from individuals under the age of 18. Trading and
          investment activities are not appropriate for minors.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3 border-b border-border pb-2">
          6. Changes to This Policy
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          We reserve the right to update this privacy policy at any time.
          Continued use of the application after changes constitutes acceptance
          of the updated policy.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3 border-b border-border pb-2">
          7. Contact
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          For privacy-related inquiries, please contact the platform
          administrator at{" "}
          <span className="text-primary font-mono">
            prakash.brjn01@gmail.com
          </span>
          .
        </p>
      </section>

      <div className="mt-10 pt-6 border-t border-border text-center text-xs text-muted-foreground space-x-2">
        <span>
          © {new Date().getFullYear()} Alpha Signal AI · All analysis is for
          educational purposes only
        </span>
        <span>·</span>
        <a href="/privacy-policy" className="text-primary hover:underline">
          Privacy Policy
        </a>
        <span>·</span>
        <Link to="/terms" className="text-primary hover:underline">
          Terms of Service
        </Link>
      </div>
    </div>
  );
}
