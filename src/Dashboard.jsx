import React, { useEffect, useState } from "react";
import { BarChart2, Film, Zap } from "lucide-react";

/**
 * Dashboard
 * Shows: credits left, videos created this month, current plan.
 * Fully responsive UI — clean for mobile and desktop.
 */
function Dashboard() {
  const [stats, setStats] = useState({
    credits: 0,
    videosThisMonth: 0,
    plan: { name: "Starter", limit: 5 },
  });
  const [loading, setLoading] = useState(true);

  // Fetch stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/user-stats`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("❌ Stats fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Card Component
  const Card = ({ title, value, subtitle, icon }) => (
    <div className="w-full sm:w-[200px] flex flex-col items-center justify-center bg-[#111827] rounded-2xl p-6 shadow-md border border-gray-800 transition-all hover:scale-[1.03]">
      {icon}
      <h2 className="mt-4 text-lg font-semibold text-gray-300">{title}</h2>
      <p className="mt-1 mb-1 text-4xl font-extrabold text-white">
        {loading ? "…" : value}
      </p>
      <span className="text-sm text-gray-400">{subtitle}</span>
    </div>
  );

  return (
    <div className="p-4 md:p-6 text-white">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <BarChart2 className="text-green-400" /> Dashboard
      </h1>

      <div className="flex flex-wrap gap-6">
        <Card
          title="Credits"
          value={stats.credits}
          subtitle="Available"
          icon={<Zap size={36} className="text-green-500" />}
        />
        <Card
          title="Videos Created"
          value={stats.videosThisMonth}
          subtitle="This Month"
          icon={<Film size={36} className="text-blue-400" />}
        />
        <Card
          title="Plan"
          value={stats.plan.name}
          subtitle={`${stats.plan.limit} videos/month`}
          icon={<BarChart2 size={36} className="text-yellow-400" />}
        />
      </div>
    </div>
  );
}

export default Dashboard;
