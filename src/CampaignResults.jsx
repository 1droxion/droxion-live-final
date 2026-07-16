import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function CampaignResults() {
  const navigate = useNavigate();

  const savedData = useMemo(() => {
    try {
      const raw = localStorage.getItem("droxion_latest_campaign");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error("Could not read campaign:", error);
      return null;
    }
  }, []);

  const campaign = savedData?.campaign;
  const form = savedData?.form;

  if (!campaign) {
    return (
      <div className="min-h-screen bg-[#09090b] px-4 py-12 text-white">
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#111216] p-8 text-center">
          <h1 className="text-2xl font-bold">No campaign found</h1>

          <p className="mt-3 text-gray-400">
            Generate a campaign first, then your results will appear here.
          </p>

          <Link
            to="/new-campaign"
            className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
          >
            Create Campaign
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <header className="border-b border-white/10 bg-[#0e0e10]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-xl font-bold">Droxion</p>
            <p className="text-xs text-gray-500">Campaign Results</p>
          </div>

          <button
            onClick={() => navigate("/new-campaign")}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500"
          >
            New Campaign
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <p className="text-sm font-semibold text-blue-400">
            Complete DTC Campaign
          </p>

          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            {form?.brandName || "Brand"} —{" "}
            {form?.productName || "Product"}
          </h1>

          <p className="mt-3 text-gray-400">
            Your positioning, customer strategy, advertising content and
            campaign assets.
          </p>
        </div>

        <div className="space-y-6">
          <ResultSection title="Product Summary">
            <RenderValue value={campaign.product_summary} />
          </ResultSection>

          <ResultSection title="Customer Avatar">
            <RenderValue value={campaign.customer_avatar} />
          </ResultSection>

          <ResultSection title="Positioning">
            <RenderValue value={campaign.positioning} />
          </ResultSection>

          <ResultSection title="Marketing Strategy">
            <RenderValue value={campaign.marketing_strategy} />
          </ResultSection>

          <ResultSection title="Ad Angles">
            <RenderValue value={campaign.ad_angles} />
          </ResultSection>

          <ResultSection title="Headlines">
            <RenderValue value={campaign.headlines} />
          </ResultSection>

          <ResultSection title="Facebook Posts">
            <RenderValue value={campaign.facebook_posts} />
          </ResultSection>

          <ResultSection title="Instagram Posts">
            <RenderValue value={campaign.instagram_posts} />
          </ResultSection>

          <ResultSection title="Email Campaign">
            <RenderValue value={campaign.email_campaign} />
          </ResultSection>

          <ResultSection title="Video Scripts">
            <RenderValue value={campaign.video_scripts} />
          </ResultSection>

          <ResultSection title="Hashtags">
            <RenderValue value={campaign.hashtags} />
          </ResultSection>
        </div>
      </main>
    </div>
  );
}

function ResultSection({ title, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#111216] p-5 sm:p-7">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>

        <button
          type="button"
          onClick={() =>
            navigator.clipboard.writeText(
              typeof children === "string"
                ? children
                : document.activeElement?.innerText || ""
            )
          }
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 hover:bg-white/10"
        >
          Copy
        </button>
      </div>

      {children}
    </section>
  );
}

function RenderValue({ value }) {
  if (value === null || value === undefined) {
    return <p className="text-gray-500">No content generated.</p>;
  }

  if (typeof value === "string") {
    return (
      <p className="whitespace-pre-wrap leading-7 text-gray-300">
        {value}
      </p>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="space-y-4">
        {value.map((item, index) => (
          <div
            key={index}
            className="rounded-xl border border-white/10 bg-[#090a0d] p-4"
          >
            <RenderValue value={item} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    return (
      <div className="space-y-4">
        {Object.entries(value).map(([key, item]) => (
          <div key={key}>
            <h3 className="mb-2 text-sm font-semibold capitalize text-blue-300">
              {key.replaceAll("_", " ")}
            </h3>

            <RenderValue value={item} />
          </div>
        ))}
      </div>
    );
  }

  return <p className="text-gray-300">{String(value)}</p>;
}
