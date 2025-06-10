import React, { useState, useEffect } from "react";
import axios from "axios";

function AIImage() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [coins, setCoins] = useState(0);
  const [selectedStyle, setSelectedStyle] = useState("Cinematic 4K");

  const styles = [
    "Cinematic 4K",
    "Anime",
    "Realistic",
    "Pixel Art",
    "Fantasy Landscape",
    "3D Render",
    "Cyberpunk",
    "Watercolor",
  ];

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL}/user-stats`)
      .then((res) => {
        setCoins(res.data.coins || 0);
      })
      .catch((err) => {
        console.warn("⚠️ Could not fetch coins.", err);
        setCoins(0);
      });
  }, []);

  const generateImage = async () => {
    if (!prompt.trim()) {
      alert("⚠️ Please enter a prompt.");
      return;
    }

    if (coins < 3) {
      if (window.confirm("❌ You don’t have enough coins. Go to Plans page to buy more?")) {
        window.location.href = "/plans";
      }
      return;
    }

    setLoading(true);
    setImageUrl("");

    try {
      const styledPrompt = `${prompt}, in ${selectedStyle} style`;

      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/generate-image`,
        { prompt: styledPrompt }
      );

      const url = response.data.image_url;
      setImageUrl(url);

      setCoins(prev => prev - 3); // Deduct 3 coins locally
    } catch (err) {
      console.error("❌ Error:", err.response?.data || err.message);
      alert("Image generation failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-10 bg-gradient-to-br from-black via-[#0f0f23] to-black text-white flex flex-col items-center justify-center">
      {/* Header */}
      <div className="flex justify-between w-full max-w-5xl mb-6">
        <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 animate-pulse">
          🪄 Create Stunning AI Images
        </h1>
        <div className="bg-black px-3 py-1 rounded text-yellow-300 font-bold text-sm border border-yellow-400 self-start">
          🪙 Coins: {coins}
        </div>
      </div>

      {/* Prompt input */}
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="✨ Describe a futuristic scene..."
        className="w-full max-w-xl p-4 mb-4 rounded-lg text-black shadow-inner border-2 border-blue-500 focus:outline-none focus:ring-4 focus:ring-purple-600 transition-all"
      />

      {/* Style selector */}
      <select
        value={selectedStyle}
        onChange={(e) => setSelectedStyle(e.target.value)}
        className="w-full max-w-xl mb-6 p-3 rounded-lg text-black border-2 border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
      >
        {styles.map((style) => (
          <option key={style} value={style}>
            🎨 {style}
          </option>
        ))}
      </select>

      {/* Generate Button */}
      <button
        onClick={generateImage}
        disabled={loading}
        className={`px-8 py-3 font-bold text-lg rounded-xl transition-all bg-gradient-to-r from-green-400 via-cyan-400 to-blue-500 hover:from-pink-500 hover:to-yellow-500 ${
          loading ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {loading ? "🌌 Generating..." : "⚡ Generate Image (3 coins)"}
      </button>

      {/* Image Preview */}
      {imageUrl && (
        <div className="mt-10 w-full flex flex-col items-center">
          <p className="text-center text-sm text-gray-400 italic mb-2">
            Style: {selectedStyle}
          </p>
          <img
            src={imageUrl}
            alt="Generated AI"
            className="rounded-2xl border-4 border-purple-500 shadow-2xl max-w-full w-[500px] transition-transform hover:scale-105 hover:rotate-1 duration-500"
          />
        </div>
      )}
    </div>
  );
}

export default AIImage;
