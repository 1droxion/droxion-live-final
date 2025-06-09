import React, { useEffect, useState } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function Analytics() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_BACKEND_URL || "https://droxion-backend.onrender.com"}/analytics-summary`)
      .then(res => setSummary(res.data))
      .catch(err => console.error("❌ Analytics Fetch Error:", err));
  }, []);

  if (!summary) return <div className="text-center mt-10">Loading analytics...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">📈 Usage Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1f2937] p-4 rounded-lg">
          <p className="text-gray-400">Total Visitors</p>
          <h2 className="text-3xl font-semibold">{summary.totalSessions}</h2>
        </div>
        <div className="bg-[#1f2937] p-4 rounded-lg">
          <p className="text-gray-400">Average Time Spent</p>
          <h2 className="text-3xl font-semibold">{summary.avgDuration} sec</h2>
        </div>
        <div className="bg-[#1f2937] p-4 rounded-lg">
          <p className="text-gray-400">Most Visited</p>
          <h2 className="text-xl font-semibold">{summary.topPath || "-"}</h2>
        </div>
      </div>

      <div className="bg-[#1f2937] p-4 rounded-lg">
        <h3 className="text-lg mb-2">Daily Visits</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={summary.dailyCounts}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
            <XAxis dataKey="date" stroke="#ccc" />
            <YAxis stroke="#ccc" />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
} 
