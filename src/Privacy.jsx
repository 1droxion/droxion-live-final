import React from "react";

function Privacy() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6">
      <h1 className="text-3xl font-bold text-green-400 mb-4">🔐 Privacy Policy</h1>

      <div className="space-y-4 text-sm leading-relaxed">
        <p>
          At Droxion, we respect your privacy and are committed to protecting
          your personal information. This policy explains how we collect, use,
          and safeguard your data.
        </p>

        <h2 className="text-lg font-semibold text-purple-400">1. Information We Collect</h2>
        <p>
          We collect basic user data like email, name, preferences, and activity
          logs for personalization and analytics. We do not sell your data.
        </p>

        <h2 className="text-lg font-semibold text-purple-400">2. How We Use Data</h2>
        <p>
          Your information is used to improve Droxion, generate AI content, provide
          support, and notify you of updates or new features.
        </p>

        <h2 className="text-lg font-semibold text-purple-400">3. Data Security</h2>
        <p>
          We use encryption, access control, and cloud security practices to keep
          your information safe and secure.
        </p>

        <h2 className="text-lg font-semibold text-purple-400">4. Cookies & Tracking</h2>
        <p>
          We may use cookies to enhance your experience. You can disable them via
          browser settings if preferred.
        </p>

        <h2 className="text-lg font-semibold text-purple-400">5. Third-Party Services</h2>
        <p>
          Droxion uses secure APIs and external services (like OpenAI, payment
          gateways). They have their own privacy terms you may refer to.
        </p>

        <h2 className="text-lg font-semibold text-purple-400">6. Refund Policy</h2>
        <p>
          Paid users can request a refund within 7 days of purchase if no videos were
          generated or if a technical issue occurred that we couldn’t resolve.
        </p>

        <p className="text-gray-400 text-xs mt-6">
          Last updated: May 2025 • For concerns email support@droxion.com
        </p>
      </div>
    </div>
  );
}

export default Privacy;
