import React, { useState, useEffect } from "react";
import axios from "axios";

function AIImage() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const generateImage = async () => {
    if (!prompt.trim()) {
      alert("⚠️ Please enter a prompt.");
      return;
    }

    setLoading(true);
    setImageUrl("");

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/images/generations",
        {
          model: "dall-e-3",
          prompt,
          n: 1,
          size: "1024x1024",
        },
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const url = response.data.data[0].url;
      setImageUrl(url);
    } catch (err) {
      console.error("❌ Error:", err.response?.data || err.message);
      alert("Image generation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-10 bg-gradient-to-br from-black via-[#0f0f23] to-black text-white flex flex-col items-center justify-center">
      <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 animate-pulse mb-6">
        🪄 Create Stunning AI Images
      </h1>

      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="✨ Describe a futuristic scene..."
        className="w-full max-w-xl p-4 mb-6 rounded-lg text-black shadow-inner border-2 border-blue-500 focus:outline-none focus:ring-4 focus:ring-purple-600 transition-all"
      />

      <button
        onClick={generateImage}
        disabled={loading}
        className={`px-8 py-3 font-bold text-lg rounded-xl transition-all bg-gradient-to-r from-green-400 via-cyan-400 to-blue-500 hover:from-pink-500 hover:to-yellow-500 ${
          loading ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {loading ? "🌌 Generating..." : "⚡ Generate Image"}
      </button>

      {imageUrl && (
        <div className="mt-10 w-full flex justify-center">
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
