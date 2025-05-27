import React from "react";

function Terms() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6">
      <h1 className="text-3xl font-bold text-green-400 mb-4">📜 Terms & Conditions</h1>
      <div className="space-y-4 text-sm leading-relaxed">
        <p>
          By using Droxion, you agree to be bound by these Terms & Conditions.
          Please read them carefully. If you do not agree, do not use our services.
        </p>

        <h2 className="text-lg font-semibold text-purple-400">1. Usage</h2>
        <p>
          You may use Droxion to generate videos and content for personal or commercial use.
          You must not use the platform for illegal, abusive, or harmful content.
        </p>

        <h2 className="text-lg font-semibold text-purple-400">2. Intellectual Property</h2>
        <p>
          All AI-generated content belongs to the user unless otherwise stated.
          Droxion retains rights to its technology, interface, and system logic.
        </p>

        <h2 className="text-lg font-semibold text-purple-400">3. Payments & Plans</h2>
        <p>
          Paid plans offer additional features and are billed monthly or yearly.
          Refunds are subject to review and can be denied if usage occurred.
        </p>

        <h2 className="text-lg font-semibold text-purple-400">4. Account Termination</h2>
        <p>
          We reserve the right to suspend accounts that violate terms or abuse resources.
        </p>

        <h2 className="text-lg font-semibold text-purple-400">5. Changes</h2>
        <p>
          Terms may be updated periodically. Continued use means acceptance of updates.
        </p>

        <p className="text-gray-400 text-xs mt-6">
          Last updated: May 2025 • For questions contact support@droxion.com
        </p>
      </div>
    </div>
  );
}

export default Terms;
