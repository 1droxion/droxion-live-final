import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiPlus,
  FiFolder,
  FiMessageSquare,
  FiArrowRight,
  FiTarget,
  FiFileText,
  FiClock,
} from "react-icons/fi";
import { supabase } from "../supabaseClient";

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("there");

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "there";

        setUserName(name);

        const { data, error } = await supabase
          .from("campaigns")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(4);

        if (error) {
          console.error("Campaign loading error:", error);
        } else {
          setCampaigns(data || []);
        }
      }
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <section className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-400">
            Welcome back
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Hello, {userName}
          </h1>

          <p className="mt-3 max-w-2xl text-gray-400">
            Create, manage and improve your DTC marketing campaigns from one
            workspace.
          </p>
        </div>

        <Link
          to="/new-campaign"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-500"
        >
          <FiPlus size={19} />
          New Campaign
        </Link>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={FiTarget}
          title="Total Campaigns"
          value={loading ? "..." : campaigns.length}
          description="Recent campaign records"
        />

        <StatCard
          icon={FiFileText}
          title="Campaign Content"
          value={loading ? "..." : campaigns.length * 8}
          description="Estimated generated sections"
        />

        <StatCard
          icon={FiClock}
          title="Latest Activity"
          value={campaigns.length ? "Active" : "None"}
          description={
            campaigns.length
              ? "Your latest campaign is saved"
              : "Create your first campaign"
          }
        />
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Quick actions</h2>
            <p className="mt-1 text-sm text-gray-500">
              Start from the task you need.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <ActionCard
            icon={FiPlus}
            title="Create Campaign"
            description="Turn one product into a complete marketing campaign."
            path="/new-campaign"
            buttonText="Start campaign"
          />

          <ActionCard
            icon={FiFolder}
            title="My Campaigns"
            description="Open, review and manage your saved campaigns."
            path="/projects"
            buttonText="View campaigns"
          />

          <ActionCard
            icon={FiMessageSquare}
            title="AI Chat"
            description="Use Droxion AI for ideas, research and assistance."
            path="/chatboard"
            buttonText="Open chat"
          />
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Recent campaigns</h2>
            <p className="mt-1 text-sm text-gray-500">
              Continue where you stopped.
            </p>
          </div>

          <Link
            to="/projects"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300"
          >
            View all
            <FiArrowRight />
          </Link>
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-[#101217] p-8 text-gray-400">
              Loading campaigns...
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-[#101217] px-6 py-12 text-center">
              <FiFolder className="mx-auto text-gray-600" size={32} />

              <h3 className="mt-4 font-bold">No campaigns yet</h3>

              <p className="mt-2 text-sm text-gray-500">
                Create your first campaign and it will appear here.
              </p>

              <Link
                to="/new-campaign"
                className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-500"
              >
                Create Campaign
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {campaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  to={`/campaign-results/${campaign.id}`}
                  className="group rounded-2xl border border-white/10 bg-[#101217] p-5 transition hover:border-blue-500/40 hover:bg-[#13161d]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                        {campaign.brand_name || "DTC Brand"}
                      </p>

                      <h3 className="mt-2 text-lg font-bold">
                        {campaign.product_name || "Untitled Campaign"}
                      </h3>
                    </div>

                    <FiArrowRight className="text-gray-600 transition group-hover:translate-x-1 group-hover:text-blue-400" />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {campaign.campaign_goal && (
                      <Tag>{campaign.campaign_goal}</Tag>
                    )}

                    {campaign.brand_tone && (
                      <Tag>{campaign.brand_tone}</Tag>
                    )}

                    {campaign.target_country && (
                      <Tag>{campaign.target_country}</Tag>
                    )}
                  </div>

                  <p className="mt-5 text-xs text-gray-600">
                    {campaign.created_at
                      ? new Date(campaign.created_at).toLocaleDateString()
                      : ""}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, title, value, description }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#101217] p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
        <Icon size={21} />
      </div>

      <p className="mt-5 text-sm text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="mt-2 text-xs text-gray-600">{description}</p>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  path,
  buttonText,
}) {
  return (
    <Link
      to={path}
      className="group rounded-2xl border border-white/10 bg-[#101217] p-6 transition hover:border-blue-500/40 hover:bg-[#13161d]"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
        <Icon size={22} />
      </div>

      <h3 className="mt-5 text-lg font-bold">{title}</h3>

      <p className="mt-2 min-h-12 text-sm leading-6 text-gray-500">
        {description}
      </p>

      <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-400">
        {buttonText}
        <FiArrowRight className="transition group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

function Tag({ children }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-gray-400">
      {children}
    </span>
  );
}
