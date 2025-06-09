import React, { useEffect, useState } from "react";
import axios from "axios";

function Analytics() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL || "https://droxion-backend.onrender.com"}/analytics`
        );
        setLogs(res.data.reverse()); // newest first
      } catch (error) {
        console.error("❌ Failed to fetch analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  return (
    <div className="text-white">
      <h2 className="text-2xl font-semibold mb-4">📊 User Analytics</h2>

      {loading ? (
        <p>Loading...</p>
      ) : logs.length === 0 ? (
        <p>No analytics data found.</p>
      ) : (
        <div className="space-y-3">
          {logs.map((log, index) => (
            <div key={index} className="bg-[#1f2937] p-3 rounded-lg shadow">
              <p><strong>Event:</strong> {log.event}</p>
              <p><strong>Path:</strong> {log.path || "—"}</p>
              <p><strong>Duration:</strong> {log.duration ? `${log.duration}s` : "—"}</p>
              <p><strong>Time:</strong> {new Date(log.timestamp).toLocaleString()}</p>
              <p className="text-xs text-gray-400">{log.userAgent?.slice(0, 50)}...</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Analytics;
