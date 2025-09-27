import React, { useEffect, useState } from "react";
import axios from "axios";

const API_BASE =
  import.meta.env.VITE_BACKEND_URL || "https://droxion-backend.onrender.com";

export function ActiveUsersCard() {
  const [data, setData] = useState({ dau: 0, wau: 0, mau: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_BASE}/stats/active`)
      .then((res) => setData(res.data || { dau: 0, wau: 0, mau: 0 }))
      .catch(() => setData({ dau: 0, wau: 0, mau: 0 }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="glass rounded-xl p-4 border border-white/10">
      <div className="text-sm text-gray-400 mb-2">Active Users</div>

      {loading ? (
        <div className="flex gap-6">
          <div className="h-8 w-12 skel rounded" />
          <div className="h-8 w-12 skel rounded" />
          <div className="h-8 w-12 skel rounded" />
        </div>
      ) : (
        <div className="flex items-end gap-8">
          <div>
            <div className="text-xs text-gray-400">DAU</div>
            <div className="text-3xl font-bold">{data.dau}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">WAU</div>
            <div className="text-3xl font-bold">{data.wau}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">MAU</div>
            <div className="text-3xl font-bold">{data.mau}</div>
          </div>
        </div>
      )}
    </div>
  );
}