import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

export default function Projects() {
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
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
        throw new Error("Your login session expired. Please log in again.");
      }

      const { data, error: campaignsError } = await supabase
        .from("campaigns")
        .select(
          `
            id,
            product_name,
            brand_name,
            product_url,
            campaign_goal,
            brand_tone,
            target_country,
            created_at,
            updated_at
          `
        )
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (campaignsError) {
        throw campaignsError;
      }

      setCampaigns(data || []);
    } catch (loadError) {
      console.error("Failed to load campaigns:", loadError);

      setError(
        loadError?.message ||
          "Could not load your campaigns. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleView = (campaignId) => {
    navigate(`/campaign-results/${campaignId}`);
  };

  const handleDelete = async (campaignId, productName) => {
    const confirmed = window.confirm(
      `Delete the campaign for "${productName}"? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(campaignId);
      setError("");

      const { error: deleteError } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", campaignId);

      if (deleteError) {
        throw deleteError;
      }

      setCampaigns((currentCampaigns) =>
        currentCampaigns.filter(
          (campaign) => campaign.id !== campaignId
        )
      );

      try {
        const latestRaw = localStorage.getItem(
          "droxion_latest_campaign"
        );

        if (latestRaw) {
          const latestCampaign = JSON.parse(latestRaw);

          if (latestCampaign?.id === campaignId) {
            localStorage.removeItem("droxion_latest_campaign");
          }
        }
      } catch (storageError) {
        console.warn(
          "Could not clean local campaign backup:",
          storageError
        );
      }
    } catch (deleteError) {
      console.error("Failed to delete campaign:", deleteError);

      setError(
        deleteError?.message ||
          "Could not delete the campaign. Please try again."
      );
    } finally {
      setDeletingId("");
    }
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return [
      campaign.product_name,
      campaign.brand_name,
      campaign.campaign_goal,
      campaign.target_country,
    ].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <header className="border-b border-white/10 bg-[#0e0e10]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xl font-bold tracking-tight">
              Droxion
            </p>

            <p className="text-xs text-gray-500">
              DTC Campaign Intelligence
            </p>
          </div>

          <Link
            to="/new-campaign"
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            + New Campaign
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
              Saved campaigns
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              My Campaigns
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400 sm:text-base">
              View, reopen, search and manage all campaigns saved
              to your Droxion account.
            </p>
          </div>

          <div className="w-full md:max-w-sm">
            <label
              htmlFor="campaign-search"
              className="mb-2 block text-sm font-medium text-gray-300"
            >
              Search campaigns
            </label>

            <input
              id="campaign-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product, brand or goal..."
              className="input-style"
            />
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            <strong className="font-semibold">Error:</strong>{" "}
            {error}
          </div>
        )}

        {loading ? (
          <LoadingState />
        ) : campaigns.length === 0 ? (
          <EmptyState />
        ) : filteredCampaigns.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#111216] p-10 text-center">
            <h2 className="text-xl font-bold">
              No matching campaigns
            </h2>

            <p className="mt-2 text-sm text-gray-400">
              Try a different product name, brand or campaign goal.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {filteredCampaigns.length}{" "}
                {filteredCampaigns.length === 1
                  ? "campaign"
                  : "campaigns"}
              </p>

              <button
                type="button"
                onClick={loadCampaigns}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white"
              >
                Refresh
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  deleting={
                    deletingId === campaign.id
                  }
                  onView={() => handleView(campaign.id)}
                  onDelete={() =>
                    handleDelete(
                      campaign.id,
                      campaign.product_name
                    )
                  }
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function CampaignCard({
  campaign,
  deleting,
  onView,
  onDelete,
}) {
  const createdDate = formatDate(campaign.created_at);

  return (
    <article className="flex min-h-[290px] flex-col rounded-2xl border border-white/10 bg-[#111216] p-5 shadow-xl transition hover:-translate-y-0.5 hover:border-blue-500/30">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-blue-400">
            {campaign.brand_name || "Untitled brand"}
          </p>

          <h2 className="mt-2 line-clamp-2 text-xl font-bold text-white">
            {campaign.product_name || "Untitled product"}
          </h2>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-xl">
          📈
        </div>
      </div>

      <div className="mt-5 space-y-3 text-sm">
        <CampaignDetail
          label="Goal"
          value={campaign.campaign_goal}
        />

        <CampaignDetail
          label="Tone"
          value={campaign.brand_tone}
        />

        <CampaignDetail
          label="Market"
          value={campaign.target_country}
        />
      </div>

      {campaign.product_url && (
        <a
          href={campaign.product_url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 truncate text-xs text-blue-400 hover:underline"
        >
          {campaign.product_url}
        </a>
      )}

      <p className="mt-auto pt-5 text-xs text-gray-500">
        Created {createdDate}
      </p>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
        <button
          type="button"
          onClick={onView}
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
        >
          View Campaign
        </button>

        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </article>
  );
}

function CampaignDetail({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-gray-500">{label}</span>

      <span className="max-w-[65%] text-right font-medium text-gray-300">
        {value || "Not specified"}
      </span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-[290px] animate-pulse rounded-2xl border border-white/10 bg-[#111216] p-5"
        >
          <div className="h-4 w-28 rounded bg-white/10" />
          <div className="mt-4 h-7 w-3/4 rounded bg-white/10" />

          <div className="mt-8 space-y-4">
            <div className="h-4 rounded bg-white/10" />
            <div className="h-4 rounded bg-white/10" />
            <div className="h-4 rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-[#111216] px-6 py-16 text-center">
      <div className="text-5xl">📦</div>

      <h2 className="mt-5 text-2xl font-bold">
        No campaigns yet
      </h2>

      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-400">
        Create your first AI marketing campaign. It will be
        saved here automatically.
      </p>

      <Link
        to="/new-campaign"
        className="mt-7 inline-flex rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500"
      >
        Create First Campaign
      </Link>
    </div>
  );
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "Unknown date";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateValue));
  } catch {
    return "Unknown date";
  }
}
