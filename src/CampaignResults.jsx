import React, { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import { supabase } from "./supabaseClient";

export default function CampaignResults() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [savedData, setSavedData] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState("");

  const localCampaign = useMemo(() => {
    try {
      const raw = localStorage.getItem(
        "droxion_latest_campaign"
      );

      return raw ? JSON.parse(raw) : null;
    } catch (storageError) {
      console.error(
        "Could not read local campaign:",
        storageError
      );

      return null;
    }
  }, []);

  useEffect(() => {
    if (!id) {
      setSavedData(localCampaign);
      setLoading(false);
      return;
    }

    const loadCampaign = async () => {
      try {
        setLoading(true);
        setError("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error(
            "Your login session expired. Please log in again."
          );
        }

        const {
          data,
          error: campaignError,
        } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", id)
          .eq("user_id", user.id)
          .single();

        if (campaignError) {
          throw campaignError;
        }

        if (!data) {
          throw new Error("Campaign not found.");
        }

        const formattedCampaign = {
          id: data.id,
          campaign: data.campaign_data,
          form: {
            productName: data.product_name,
            brandName: data.brand_name,
            productUrl: data.product_url || "",
            price: data.price || "",
            currency: data.currency || "USD",
            targetCountry:
              data.target_country || "",
            campaignGoal:
              data.campaign_goal || "",
            brandTone: data.brand_tone || "",
            targetCustomer:
              data.target_customer || "",
            productDescription:
              data.product_description || "",
            keyBenefits:
              data.key_benefits || "",
            specialOffer:
              data.special_offer || "",
          },
          createdAt: data.created_at,
        };

        setSavedData(formattedCampaign);

        localStorage.setItem(
          "droxion_latest_campaign",
          JSON.stringify(formattedCampaign)
        );
      } catch (loadError) {
        console.error(
          "Could not load campaign:",
          loadError
        );

        setError(
          loadError?.message ||
            "Could not load this campaign."
        );
      } finally {
        setLoading(false);
      }
    };

    loadCampaign();
  }, [id, localCampaign]);

  const campaign = savedData?.campaign;
  const form = savedData?.form;

  if (loading) {
    return <CampaignLoading />;
  }

  if (error) {
    return (
      <CampaignMessage
        title="Could not load campaign"
        message={error}
      />
    );
  }

  if (!campaign) {
    return (
      <CampaignMessage
        title="No campaign found"
        message="Generate a campaign first, or open one from My Campaigns."
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <header className="border-b border-white/10 bg-[#0e0e10]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-xl font-bold">
              Droxion
            </p>

            <p className="text-xs text-gray-500">
              Campaign Results
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("/projects")}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              My Campaigns
            </button>

            <button
              type="button"
              onClick={() =>
                navigate("/new-campaign")
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold transition hover:bg-blue-500"
            >
              New Campaign
            </button>
          </div>
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

          <div className="mt-4 flex flex-wrap gap-2">
            {form?.campaignGoal && (
              <CampaignBadge>
                {form.campaignGoal}
              </CampaignBadge>
            )}

            {form?.brandTone && (
              <CampaignBadge>
                {form.brandTone}
              </CampaignBadge>
            )}

            {form?.targetCountry && (
              <CampaignBadge>
                {form.targetCountry}
              </CampaignBadge>
            )}
          </div>

          <p className="mt-4 text-gray-400">
            Your positioning, customer strategy,
            advertising content and campaign assets.
          </p>
        </div>

        <div className="space-y-6">
          <ResultSection
            title="Product Summary"
            value={campaign.product_summary}
          />

          <ResultSection
            title="Customer Avatar"
            value={campaign.customer_avatar}
          />

          <ResultSection
            title="Positioning"
            value={campaign.positioning}
          />

          <ResultSection
            title="Marketing Strategy"
            value={campaign.marketing_strategy}
          />

          <ResultSection
            title="Ad Angles"
            value={campaign.ad_angles}
          />

          <ResultSection
            title="Headlines"
            value={campaign.headlines}
          />

          <ResultSection
            title="Facebook Posts"
            value={campaign.facebook_posts}
          />

          <ResultSection
            title="Instagram Posts"
            value={campaign.instagram_posts}
          />

          <ResultSection
            title="Email Campaign"
            value={campaign.email_campaign}
          />

          <ResultSection
            title="Video Scripts"
            value={campaign.video_scripts}
          />

          <ResultSection
            title="Hashtags"
            value={campaign.hashtags}
          />
        </div>
      </main>
    </div>
  );
}

function ResultSection({ title, value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        formatForClipboard(value)
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (copyError) {
      console.error(
        "Could not copy section:",
        copyError
      );
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-[#111216] p-5 sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">
          {title}
        </h2>

        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 transition hover:bg-white/10"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <RenderValue value={value} />
    </section>
  );
}

function RenderValue({ value }) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return (
      <p className="text-gray-500">
        No content generated.
      </p>
    );
  }

  if (typeof value === "string") {
    return (
      <p className="whitespace-pre-wrap leading-7 text-gray-300">
        {value}
      </p>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <p className="text-gray-500">
          No content generated.
        </p>
      );
    }

    return (
      <div className="space-y-4">
        {value.map((item, index) => (
          <div
            key={`${index}-${JSON.stringify(item)}`}
            className="rounded-xl border border-white/10 bg-[#090a0d] p-4"
          >
            <RenderValue value={item} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      return (
        <p className="text-gray-500">
          No content generated.
        </p>
      );
    }

    return (
      <div className="space-y-5">
        {entries.map(([key, item]) => (
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

  return (
    <p className="text-gray-300">
      {String(value)}
    </p>
  );
}

function CampaignBadge({ children }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-gray-300">
      {children}
    </span>
  );
}

function CampaignLoading() {
  return (
    <div className="min-h-screen bg-[#09090b] px-4 py-12 text-white">
      <div className="mx-auto max-w-4xl animate-pulse">
        <div className="h-5 w-36 rounded bg-white/10" />
        <div className="mt-5 h-10 w-3/4 rounded bg-white/10" />

        <div className="mt-10 space-y-5">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-52 rounded-2xl border border-white/10 bg-[#111216]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CampaignMessage({ title, message }) {
  return (
    <div className="min-h-screen bg-[#09090b] px-4 py-12 text-white">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#111216] p-8 text-center">
        <h1 className="text-2xl font-bold">
          {title}
        </h1>

        <p className="mt-3 text-gray-400">
          {message}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/projects"
            className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-semibold text-gray-300 transition hover:bg-white/10"
          >
            My Campaigns
          </Link>

          <Link
            to="/new-campaign"
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500"
          >
            Create Campaign
          </Link>
        </div>
      </div>
    </div>
  );
}

function formatForClipboard(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        return `${index + 1}. ${formatForClipboard(
          item
        )}`;
      })
      .join("\n\n");
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => {
        const title = key
          .replaceAll("_", " ")
          .replace(/\b\w/g, (character) =>
            character.toUpperCase()
          );

        return `${title}\n${formatForClipboard(
          item
        )}`;
      })
      .join("\n\n");
  }

  return String(value);
}
