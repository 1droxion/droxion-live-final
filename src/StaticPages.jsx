import React from "react";

export function Privacy() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6">
      <h2 className="text-3xl font-bold text-green-400 mb-6">🔐 Privacy Policy</h2>
      <div className="space-y-4 text-sm leading-relaxed">
        <p>
          Droxion respects your privacy. This policy explains what data we collect,
          how we use it, and your rights as a user of our AI video generation platform.
        </p>

        <h3 className="text-lg font-semibold text-purple-300">1. What We Collect</h3>
        <p>
          We collect account info (like name, email), usage data (topics, video
          settings), and logs for analytics and system improvement.
        </p>

        <h3 className="text-lg font-semibold text-purple-300">2. How It's Used</h3>
        <p>
          Your data helps us provide better video results, support you, and
          personalize content. We never sell or misuse your data.
        </p>

        <h3 className="text-lg font-semibold text-purple-300">3. Storage & Security</h3>
        <p>
          All data is stored securely with encryption and access control. Your video
          content is private and only visible to your account.
        </p>

        <h3 className="text-lg font-semibold text-purple-300">4. Refund Policy</h3>
        <p>
          If no videos were generated within 7 days of payment and you’re unsatisfied,
          you may request a full refund at support@droxion.com.
        </p>

        <p className="text-xs text-gray-400 mt-6">Last updated: May 2025</p>
      </div>
    </div>
  );
}

export function Terms() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6">
      <h2 className="text-3xl font-bold text-green-400 mb-6">📜 Terms & Conditions</h2>
      <div className="space-y-4 text-sm leading-relaxed">
        <p>
          By using Droxion, you agree to the following terms. Please read carefully.
        </p>

        <h3 className="text-lg font-semibold text-purple-300">1. Content Usage</h3>
        <p>
          All content generated through Droxion is owned by you, the creator. However,
          you may not use Droxion to create illegal, violent, or hateful content.
        </p>

        <h3 className="text-lg font-semibold text-purple-300">2. System Limits</h3>
        <p>
          Abuse of the AI generation system, such as automated spam or excessive usage
          outside your plan, may result in account suspension.
        </p>

        <h3 className="text-lg font-semibold text-purple-300">3. Changes</h3>
        <p>
          Terms may be updated anytime. Continued use after changes indicates
          acceptance.
        </p>

        <p className="text-xs text-gray-400 mt-6">Last updated: May 2025</p>
      </div>
    </div>
  );
}

export function Support() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6">
      <h2 className="text-3xl font-bold text-green-400 mb-6">🛠 Support</h2>
      <div className="space-y-4 text-sm leading-relaxed">
        <p>
          Need help with Droxion? Reach out and we’ll assist you as fast as possible.
        </p>

        <h3 className="text-lg font-semibold text-purple-300">📬 Contact Email</h3>
        <p>support@droxion.com</p>

        <h3 className="text-lg font-semibold text-purple-300">💬 Chatboard</h3>
        <p>Use the built-in AI chat assistant to get quick help with settings, features, and usage.</p>

        <h3 className="text-lg font-semibold text-purple-300">📦 Billing or Refund?</h3>
        <p>
          For billing issues, contact our finance team at finance@droxion.com or
          submit a ticket on your Plans page.
        </p>

        <p className="text-xs text-gray-400 mt-6">Support team active Mon–Sat • 10AM–6PM IST</p>
      </div>
    </div>
  );
}
