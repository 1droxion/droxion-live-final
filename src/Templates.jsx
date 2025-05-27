import React from "react";
import { useNavigate } from "react-router-dom";

function Templates() {
  const navigate = useNavigate();

  const templates = [
    {
      name: "Motivational Boost",
      description: "Create high-energy reels for mindset & hustle.",
      config: {
        topic: "Success",
        language: "Hindi",
        voice: "onyx",
        style: "Cinematic",
        captions: "Word-by-Word",
        musicVolume: "Medium Volume",
        branding: "Yes",
        clipCount: 10,
        voiceSpeed: 1.0,
        manualScript: "no",
        userScript: "",
      },
    },
    {
      name: "Funny Meme Edit",
      description: "Short, funny punchline reels with comedic tone.",
      config: {
        topic: "Desi Jokes",
        language: "Hindi",
        voice: "fable",
        style: "Funny",
        captions: "Line-by-Line",
        musicVolume: "High Volume",
        branding: "No",
        clipCount: 8,
        voiceSpeed: 1.1,
        manualScript: "no",
        userScript: "",
      },
    },
    {
      name: "Romantic Quote",
      description: "Smooth reels for love quotes and emotions.",
      config: {
        topic: "Love",
        language: "English",
        voice: "shimmer",
        style: "Emotional",
        captions: "Word-by-Word",
        musicVolume: "Low Volume",
        branding: "Yes",
        clipCount: 6,
        voiceSpeed: 0.9,
        manualScript: "no",
        userScript: "",
      },
    },
    {
      name: "Spiritual Vibe",
      description: "Bhakti & motivational reels in regional voice.",
      config: {
        topic: "Bhagavad Gita",
        language: "Gujarati",
        voice: "nova",
        style: "Inspirational",
        captions: "Word-by-Word",
        musicVolume: "Medium Volume",
        branding: "Yes",
        clipCount: 7,
        voiceSpeed: 1.0,
        manualScript: "no",
        userScript: "",
      },
    },
  ];

  const applyTemplate = (config) => {
    localStorage.setItem("template_config", JSON.stringify(config));
    navigate("/generator");
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white px-4 py-10">
      <h1 className="text-4xl font-extrabold text-green-400 text-center mb-10">
        🎨 Ready-Made Templates
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {templates.map((t, i) => (
          <div
            key={i}
            className="bg-[#1e293b] p-6 rounded-2xl border border-gray-700 shadow-md hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1"
          >
            <h2 className="text-xl font-bold mb-2">{t.name}</h2>
            <p className="text-sm text-gray-300 mb-5">{t.description}</p>
            <button
              onClick={() => applyTemplate(t.config)}
              className="w-full bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-lime-500 py-2 rounded-lg text-white font-semibold shadow"
            >
              Use Template →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Templates;
