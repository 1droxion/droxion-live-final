import React from "react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#08090c] text-white">
      <header className="border-b border-white/10 bg-[#0d0f14]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xl font-bold tracking-tight">Droxion</p>
            <p className="text-xs text-gray-500">
              AI Marketing for DTC Brands
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-gray-300 transition hover:bg-white/5 hover:text-white"
            >
              Log in
            </Link>

            <Link
              to="/signup"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Start Free
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-28">
          <div>
            <div className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
              Built for DTC brands
            </div>

            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Turn one product into a complete marketing campaign
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-gray-400 sm:text-lg">
              Droxion creates positioning, customer research, ad angles,
              social content, email campaigns and video scripts from one
              product brief.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/signup"
                className="rounded-xl bg-blue-600 px-6 py-4 text-center font-bold text-white transition hover:bg-blue-500"
              >
                Generate Your First Campaign
              </Link>

              <a
                href="#how-it-works"
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-4 text-center font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white"
              >
                See How It Works
              </a>
            </div>

            <p className="mt-4 text-sm text-gray-500">
              No agency. No complicated prompts. No scattered tools.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#111216] p-5 shadow-2xl">
            <div className="rounded-2xl border border-white/10 bg-[#090a0d] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                    Example campaign
                  </p>
                  <h2 className="mt-2 text-xl font-bold">
                    Hydration Serum Launch
                  </h2>
                </div>

                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Ready
                </span>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  "Product positioning",
                  "Customer profile",
                  "6 ad angles",
                  "10 headlines",
                  "Social posts",
                  "Email campaign",
                  "3 video scripts",
                  "Hashtag set",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-300"
                  >
                    ✓ {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="border-y border-white/10 bg-[#0d0f14]"
        >
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-blue-400">
                How it works
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                One simple workflow
              </h2>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              <Step
                number="1"
                title="Add your product"
                text="Enter your product, audience, benefits, offer and campaign goal."
              />

              <Step
                number="2"
                title="Generate the campaign"
                text="Droxion creates your strategy, ads, posts, emails and scripts."
              />

              <Step
                number="3"
                title="Save and reuse"
                text="Open campaigns anytime, copy sections and improve future launches."
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 px-6 py-12 text-center sm:px-10">
            <h2 className="text-3xl font-bold">
              Build your next campaign in minutes
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-gray-300">
              Stop switching between multiple AI tools. Give Droxion one
              product and get one complete campaign.
            </p>

            <Link
              to="/signup"
              className="mt-8 inline-flex rounded-xl bg-blue-600 px-6 py-4 font-bold text-white transition hover:bg-blue-500"
            >
              Start Free
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function Step({ number, title, text }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111216] p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold">
        {number}
      </div>

      <h3 className="mt-5 text-xl font-bold">{title}</h3>

      <p className="mt-3 text-sm leading-6 text-gray-400">
        {text}
      </p>
    </div>
  );
}
