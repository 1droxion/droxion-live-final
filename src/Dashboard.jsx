import React, { useEffect, useState } from "react";
import { BarChart2, Film, Zap } from "lucide-react";

/**
 * Dashboard 2090
 * Beautiful futuristic dashboard showing credits, videos, and plan.
 * Styled with glow effects, gradient text, hover animations.
 */
function Dashboard() {
  const [stats, setStats] = useState({
    credits: 0,
    videosThisMonth: 0,
    plan: { name: "Starter", limit: 5 },
  });
  const [loading, setLoading] = useState(true);

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

  const Card = ({ title, value, subtitle, icon }) => (
    <div className="w-full sm:w-[220px] flex flex-col items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#1a1a2e] rounded-2xl p-6 shadow-xl border border-[#2a2a40] hover:scale-[1.03] transition-all duration-300">
      <div className="text-4xl mb-2 animate-bounce">
        {icon}
      </div>
      <h2 className="text-lg font-semibold text-gradient bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
        {title}
      </h2>
      <p className="text-5xl font-extrabold text-white drop-shadow-xl my-1">
        {loading ? "…" : value}
      </p>
      <span className="text-sm text-gray-400 italic">{subtitle}</span>
    </div>
  );

  return (
    <div className="p-6 min-h-screen bg-[#0e0e10] text-white animate-fade-in">
      <h1 className="text-4xl font-bold mb-10 text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-green-400 to-blue-500 animate-pulse">
        ⚡ Welcome to Droxion Dashboard
      </h1>

      <div className="flex flex-wrap gap-6 justify-center">
        <Card
          title="⚡ Credits"
          value={stats.credits}
          subtitle="Available"
          icon={<Zap size={40} className="text-green-400 drop-shadow" />} />

        <Card
          title="🎬 Videos Created"
          value={stats.videosThisMonth}
          subtitle="This Month"
          icon={<Film size={40} className="text-blue-400 drop-shadow" />} />

        <Card
          title="💼 Plan"
          value={stats.plan.name}
          subtitle={`${stats.plan.limit} videos/month`}
          icon={<BarChart2 size={40} className="text-yellow-400 drop-shadow" />} />
      </div>
    </div>
  );
}

export default Dashboard;
