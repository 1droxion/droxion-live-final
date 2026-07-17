import React from "react";
import { Link } from "react-router-dom";
import {
  FiArrowRight,
  FiCheck,
  FiTarget,
  FiZap,
  FiBarChart2,
  FiLayers,
} from "react-icons/fi";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#08090c] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="text-2xl font-bold">
            Droxion
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-gray-400 md:flex">
            <a href="#features" className="hover:text-white">
              Features
            </a>

            <a href="#how-it-works" className="hover:text-white">
              How it works
            </a>

            <a href="#pricing" className="hover:text-white">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-300 transition hover:bg-white/5 hover:text-white"
            >
              Login
            </Link>

            <Link
              to="/signup"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500"
            >
              Start Free
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute left-1/2 top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-600/20 blur-[120px]" />

          <div className="relative mx-auto max-w-7xl px-5 py-24 text-center sm:px-8 sm:py-32">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-300">
              <FiZap />
              AI growth platform for DTC brands
            </div>

            <h1 className="mx-auto mt-8 max-w-5xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              Turn one product into a complete
              <span className="text-blue-500"> marketing campaign</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-400">
              Droxion researches your customer, creates your strategy, writes
              your ads and builds social content from one simple product brief.
            </p>

            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-4 font-bold transition hover:bg-blue-500"
              >
                Create your first campaign
                <FiArrowRight />
              </Link>

              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-7 py-4 font-bold text-gray-200 transition hover:bg-white/10"
              >
                Open workspace
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-gray-500">
              <FeatureCheck text="No credit card required" />
              <FeatureCheck text="Campaign in minutes" />
              <FeatureCheck text="Built for DTC brands" />
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-white/10 bg-[#0d0f14]">
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-semibold text-blue-400">
                Everything in one workspace
              </p>

              <h2 className="mt-3 text-3xl font-bold sm:text-5xl">
                From product idea to campaign execution
              </h2>

              <p className="mt-5 text-gray-400">
                Stop switching between separate research, copywriting and
                planning tools.
              </p>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                icon={FiTarget}
                title="Customer Research"
                description="Understand your target customer, needs, objections and buying motivations."
              />

              <FeatureCard
                icon={FiLayers}
                title="Campaign Strategy"
                description="Generate positioning, offers, messaging and a complete launch strategy."
              />

              <FeatureCard
                icon={FiZap}
                title="AI Content"
                description="Create ads, captions, emails, hooks, scripts and content ideas."
              />

              <FeatureCard
                icon={FiBarChart2}
                title="Campaign Workspace"
                description="Save, organize and improve every campaign inside one dashboard."
              />
            </div>
          </div>
        </section>

        <section id="how-it-works">
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="font-semibold text-blue-400">
                  Simple campaign creation
                </p>

                <h2 className="mt-3 text-3xl font-bold sm:text-5xl">
                  Give Droxion your product. Get the full strategy.
                </h2>

                <p className="mt-5 max-w-xl text-lg leading-8 text-gray-400">
                  You do not need to understand complicated marketing systems.
                  Add your product information and Droxion organizes the rest.
                </p>
              </div>

              <div className="space-y-4">
                <Step
                  number="01"
                  title="Add your product"
                  description="Enter your brand, product, customer and campaign goal."
                />

                <Step
                  number="02"
                  title="Generate the campaign"
                  description="Droxion builds research, positioning, ads and content."
                />

                <Step
                  number="03"
                  title="Save and improve"
                  description="Open your campaign anytime and continue building."
                />
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-t border-white/10 bg-[#0d0f14]">
          <div className="mx-auto max-w-7xl px-5 py-24 text-center sm:px-8">
            <p className="font-semibold text-blue-400">
              Start building today
            </p>

            <h2 className="mt-3 text-3xl font-bold sm:text-5xl">
              Your AI marketing team in one platform
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-gray-400">
              Create your account and build your first Droxion campaign.
            </p>

            <Link
              to="/signup"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-4 font-bold transition hover:bg-blue-500"
            >
              Start Free
              <FiArrowRight />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© 2026 Droxion. All rights reserved.</p>

          <div className="flex gap-6">
            <a href="#features" className="hover:text-white">
              Features
            </a>

            <Link to="/login" className="hover:text-white">
              Login
            </Link>

            <Link to="/signup" className="hover:text-white">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCheck({ text }) {
  return (
    <div className="flex items-center gap-2">
      <FiCheck className="text-green-400" />
      <span>{text}</span>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#13161d] p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
        <Icon size={22} />
      </div>

      <h3 className="mt-5 text-lg font-bold">{title}</h3>

      <p className="mt-3 text-sm leading-6 text-gray-500">
        {description}
      </p>
    </div>
  );
}

function Step({ number, title, description }) {
  return (
    <div className="flex gap-5 rounded-2xl border border-white/10 bg-[#13161d] p-6">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 font-bold">
        {number}
      </div>

      <div>
        <h3 className="text-lg font-bold">{title}</h3>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          {description}
        </p>
      </div>
    </div>
  );
}
