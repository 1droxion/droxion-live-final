import { Link } from "react-router-dom";

export default function DeleteAccount() {
  return (
    <main className="min-h-screen bg-[#07070b] text-white px-5 py-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-[#111118] p-6 sm:p-8">
        <div className="mb-6">
          <Link to="/" className="text-sm font-semibold text-purple-400 hover:text-purple-300">← Droxion Live</Link>
        </div>

        <h1 className="text-3xl font-black">Delete your Droxion Live account</h1>
        <p className="mt-3 text-gray-300">
          You can request permanent deletion of your Droxion Live account and associated personal data at any time.
        </p>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold">Delete from the app</h2>
          <p className="text-gray-300">
            Sign in to Droxion Live, open Me/Profile, choose Delete Account, and confirm the deletion request.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold">Request deletion without the app</h2>
          <p className="text-gray-300">
            Email <a className="font-semibold text-purple-400 hover:text-purple-300" href="mailto:support@droxion.com?subject=Delete%20my%20Droxion%20Live%20account">support@droxion.com</a> from the email address associated with your Droxion account. Use the subject “Delete my Droxion Live account”. We may ask you to verify account ownership before completing the request.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold">Data deleted</h2>
          <p className="text-gray-300">
            Account access, profile information, messages, LIVE activity, follows, blocks, reports, and other account-associated data are deleted or de-identified when the request is completed, except where limited retention is required.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold">Limited data we may retain</h2>
          <p className="text-gray-300">
            Certain transaction, payout, fraud-prevention, dispute, safety, tax, or legal-compliance records may be retained only for as long as reasonably necessary or legally required, then deleted or de-identified.
          </p>
        </section>

        <p className="mt-8 text-sm text-gray-500">Droxion Live · 1Dhruv LLC</p>
      </div>
    </main>
  );
}
