import React from "react";
import { Instagram, Youtube, Facebook, Send, Zap, Cloud } from "lucide-react";

const platforms = [
  {
    name: "Instagram",
    icon: <Instagram size={32} />,
    status: "Planned",
    color: "bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500",
  },
  {
    name: "YouTube",
    icon: <Youtube size={32} />,
    status: "Coming Soon",
    color: "bg-red-600",
  },
  {
    name: "Facebook",
    icon: <Facebook size={32} />,
    status: "Coming Soon",
    color: "bg-blue-700",
  },
  {
    name: "WhatsApp",
    icon: <Send size={32} />,
    status: "Coming Soon",
    color: "bg-green-600",
  },
  {
    name: "Zapier",
    icon: <Zap size={32} />,
    status: "Integration Ready",
    color: "bg-yellow-400 text-black",
  },
  {
    name: "Google Drive",
    icon: <Cloud size={32} />,
    status: "Planned",
    color: "bg-gray-600",
  },
];

function Connect() {
  return (
    <div className="min-h-screen p-6 text-white">
      <h1 className="text-3xl font-bold text-green-400 mb-6 text-center">
        🔗 Connect to Platforms
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {platforms.map((p, i) => (
          <div
            key={i}
            className={`rounded-xl p-5 flex items-center gap-4 shadow border border-gray-700 ${p.color}`}
          >
            <div className="bg-black/30 p-2 rounded-full">{p.icon}</div>
            <div>
              <h2 className="text-lg font-bold">{p.name}</h2>
              <p className="text-sm text-white/80">{p.status}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Connect;
