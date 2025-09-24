import React, { useEffect, useMemo, useState } from "react";
import { BarChart2, Film, Zap } from "lucide-react";

/**
 * Dashboard — Day Report
 * - Shows today's DAU, Visits, Chats, Unique IPs
 * - Filters today's logs with IP + path + details
 * - Uses your gradient/glow style, with non-blinking loads
 *
 * Requires backend:
 *   GET /metrics?days=1&tz_offset_minutes=<minutes>
 *   GET /logs?limit=200
 *
 * API base comes from Vite env: VITE_API_URL (e.g. https://droxion-backend.onrender.com)
 */
const API_BASE = import.meta.env.VITE_API_URL;

function Spark({ data = [], width = 120, height = 36, pad = 4 }) {
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;
  const pts = data.map((v, i) => {
    const x = pad + i * step;
    const y = height - pad - (v / max) * (height - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block", opacity: 0.9 }}>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts} />
    </svg>
  );
}

function Card({ title, value, subtitle, icon, children }) {
  return (
    <div className="w-full sm:w-[260px] flex flex-col items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#1a1a2e] rounded-2xl p-6 shadow-xl border border-[#2a2a40] hover:scale-[1.03] transition-all duration-300">
      <div className="text-4xl mb-2">{icon}</div>
      <h2 className="text-lg font-semibold text-gradient bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
        {title}
      </h2>
      <p className="text-5xl font-extrabold text-white drop-shadow-xl my-1">
        {value}
      </p>
      <span className="text-sm text-gray-400 italic">{subtitle}</span>
      {children ? <div className="mt-3 text-gray-300 w-full">{children}</div> : null}
    </div>
  );
}

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);        // { DAU, total_visits, ... }
  const [series, setSeries] = useState(null);    // { dates, visits, chats, unique_ips }
  const [logs, setLogs] = useState([]);          // today-only logs
  const [err, setErr] = useState("");

  // Keep last-good state to avoid blink
  const [lastGood, setLastGood] = useState({ kpis: null, series: null, logs: [] });

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setErr("");
      try {
        const tz = -new Date().getTimezoneOffset(); // minutes offset from UTC
        const [mRes, lRes] = await Promise.all([
          fetch(`${API_BASE}/metrics?days=1&tz_offset_minutes=${tz}`, { credentials: "include" }),
          fetch(`${API_BASE}/logs?limit=200`, { credentials: "include" })
        ]);

        const m = mRes.ok ? await mRes.json() : null;
        const l = lRes.ok ? await lRes.json() : null;

        if (!alive) return;

        const seriesIn = m?.series || null;
        const kpisIn = m?.kpis || null;

        // Filter today's logs using local tz (align with tz used in metrics)
        const todayLocalISO = new Date(Date.now() + tz * 60 * 1000).toISOString().slice(0, 10);
        const todayLogs = (l?.rows || []).filter((row) => {
          try {
            const d = new Date(row.ts);
            const localISO = new Date(d.getTime() + tz * 60 * 1000).toISOString().slice(0, 10);
            return localISO === todayLocalISO;
          } catch {
            return false;
          }
        });

        // Only update if payload changed (prevents flicker)
        const strA = JSON.stringify({ kpis: kpisIn, series: seriesIn });
        const strB = JSON.stringify({ kpis: lastGood.kpis, series: lastGood.series });
        if (strA !== strB) {
          setKpis(kpisIn);
          setSeries(seriesIn);
        } else {
          // Reuse last-good to avoid visual changes
          setKpis(lastGood.kpis);
          setSeries(lastGood.series);
        }

        setLogs(todayLogs);
        setLastGood({ kpis: kpisIn || lastGood.kpis, series: seriesIn || lastGood.series, logs: todayLogs || lastGood.logs });
      } catch (e) {
        console.error("❌ Day report error:", e);
        setErr("Could not load day report.");
        // fall back to last good
        setKpis(lastGood.kpis);
        setSeries(lastGood.series);
        setLogs(lastGood.logs);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []); // load once on mount

  // Extract today's numbers safely
  const visitsToday = useMemo(() => (series?.visits?.[0] ?? 0), [series]);
  const chatsToday = useMemo(() => (series?.chats?.[0] ?? 0), [series]);
  const uniqueIPsToday = useMemo(() => (series?.unique_ips?.[0] ?? 0), [series]);
  const dau = useMemo(() => (kpis?.DAU ?? uniqueIPsToday), [kpis, uniqueIPsToday]);

  // Minimal spark data (with a tiny fake buffer to show a line without jumping)
  const sparkData = useMemo(() => {
    const v = series?.visits || [];
    // If only 1 point (today), make a tiny 2-pt spark to avoid flat-dot look
    return v.length >= 2 ? v : [0, v[0] || 0];
  }, [series]);

  return (
    <div className="p-6 min-h-screen bg-[#0e0e10] text-white">
      <h1 className="text-4xl font-bold mb-10 text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-green-400 to-blue-500">
        📅 Droxion — Day Report
      </h1>

      {/* KPIs row */}
      <div className="flex flex-wrap gap-6 justify-center">
        <Card
          title="👥 DAU (Today)"
          value={loading ? "…" : dau}
          subtitle="Unique IPs today"
          icon={<BarChart2 size={40} className="text-yellow-400 drop-shadow" />}>
          <div className="text-xs text-gray-400">Equivalent metric: unique IPs for today.</div>
        </Card>

        <Card
          title="⚡ Visits (Today)"
          value={loading ? "…" : visitsToday}
          subtitle="Counts repeat visits"
          icon={<Zap size={40} className="text-green-400 drop-shadow" />}>
          <div className="text-xs text-gray-400">Repeat hits from same IP are counted.</div>
          <div className="mt-2 text-green-300">
            <Spark data={sparkData} />
          </div>
        </Card>

        <Card
          title="💬 Chats (Today)"
          value={loading ? "…" : chatsToday}
          subtitle="Messages sent"
          icon={<Film size={40} className="text-blue-400 drop-shadow" />}>
          <div className="text-xs text-gray-400">Chat events recorded by /chat.</div>
        </Card>

        <Card
          title="🌐 Unique IPs (Today)"
          value={loading ? "…" : uniqueIPsToday}
          subtitle="Distinct visitors"
          icon={<BarChart2 size={40} className="text-purple-400 drop-shadow" />}>
          <div className="text-xs text-gray-400">Based on IP per local day.</div>
        </Card>
      </div>

      {/* Error note */}
      {err && (
        <div className="max-w-4xl mx-auto mt-6 text-center text-sm text-red-400">
          {err}
        </div>
      )}

      {/* Logs table (today only) */}
      <div className="max-w-6xl mx-auto mt-10">
        <div className="text-lg font-semibold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
          Today’s Activity
        </div>
        <div className="rounded-2xl border border-[#2a2a40] bg-gradient-to-br from-[#0f172a] to-[#1a1a2e] shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-400 border-b border-[#2a2a40]">
                <tr>
                  <th className="text-left py-3 px-4">Time (UTC)</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">IP</th>
                  <th className="text-left py-3 px-4">Path</th>
                  <th className="text-left py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody>
                {(loading ? Array.from({ length: 6 }).map(() => null) : logs).map((r, i) => r ? (
                  <tr key={i} className="border-b border-[#202036] hover:bg-white/5 transition">
                    <td className="py-2 px-4">{r.ts}</td>
                    <td className="py-2 px-4">{r.type}</td>
                    <td className="py-2 px-4">{r.ip}</td>
                    <td className="py-2 px-4">{r.path}</td>
                    <td className="py-2 px-4"><code className="text-[11px]">{JSON.stringify(r.details || {})}</code></td>
                  </tr>
                ) : (
                  <tr key={i} className="border-b border-[#202036]">
                    <td className="py-2 px-4"><div className="h-3 w-28 bg-white/10 rounded" /></td>
                    <td className="py-2 px-4"><div className="h-3 w-16 bg-white/10 rounded" /></td>
                    <td className="py-2 px-4"><div className="h-3 w-20 bg-white/10 rounded" /></td>
                    <td className="py-2 px-4"><div className="h-3 w-28 bg-white/10 rounded" /></td>
                    <td className="py-2 px-4"><div className="h-3 w-40 bg-white/10 rounded" /></td>
                  </tr>
                ))}
                {!loading && logs.length === 0 && (
                  <tr>
                    <td className="py-4 px-4 text-gray-400 text-center" colSpan={5}>
                      No activity yet today.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Small footer note */}
        <div className="text-xs text-gray-500 mt-3">
          Local timezone is respected via <code>tz_offset_minutes</code>. To change the day boundary, pass a different offset.
        </div>
      </div>
    </div>
  );
}

export default Dashboard;