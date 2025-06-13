// SmartBar.jsx
import React, { useState } from "react";
import axios from "axios";

function SmartBar() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setResponse("");
    setImageUrl("");
    setVideoUrl("");

    const prompt = input.toLowerCase();

    try {
      if (prompt.startsWith("draw") || prompt.includes("image") || prompt.includes("picture")) {
        // AI Image
        const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/generate-image`, { prompt });
        setImageUrl(res.data.image_url[0]);
      } else if (prompt.includes("reel") || prompt.includes("video") || prompt.includes("make a cinematic")) {
        // Reel
        const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/generate`, {
          topic: input,
          language: "English",
          style: "Cinematic",
          captions: "Word-by-Word",
          branding: "Yes",
          musicVolume: "Medium Volume",
          clipCount: 10,
          voice: "onyx",
          voiceSpeed: 1.0,
          subtitlePosition: "Bottom",
          length: "Medium",
          mode: "Auto",
          userScript: "",
        });
        setVideoUrl(`${import.meta.env.VITE_BACKEND_URL}${res.data.videoUrl}`);
      } else {
        // Chat
        const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/chat`, { prompt: input });
        let reply = res.data.reply;

        // 🧠 Simple link detection
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        if (urlRegex.test(reply)) {
          reply = reply.replace(urlRegex, (url) => `<a href="${url}" target="_blank" class="text-blue-400 underline">${url}</a>`);
        }

        setResponse(reply);
      }
    } catch (err) {
      setResponse("❌ Failed to process your request.");
    }

    setLoading(false);
  };

  // 🎤 Voice input using browser mic
  const handleVoice = () => {
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.start();
    recognition.onresult = (event) => {
      const voiceText = event.results[0][0].transcript;
      setInput(voiceText);
    };
  };

  return (
    <div className="p-8 max-w-4xl mx-auto text-white">
      <h1 className="text-3xl font-bold text-center mb-6 text-purple-400">⚡ Droxion Smart AI Bar</h1>

      <div className="flex gap-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Say or type: draw Elon in space, make reel on focus, latest news..."
          className="flex-grow p-4 rounded bg-[#1f2937] text-white placeholder-gray-400"
        />
        <button onClick={handleVoice} className="bg-yellow-500 px-4 rounded">🎤</button>
        <button onClick={handleSubmit} disabled={loading} className="bg-green-500 px-6 py-3 rounded text-lg font-bold">
          {loading ? "..." : "Run"}
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {response && (
          <div
            className="bg-[#222] p-4 rounded text-green-300 prose prose-invert"
            dangerouslySetInnerHTML={{ __html: response }}
          />
        )}
        {imageUrl && <img src={imageUrl} alt="Generated" className="rounded-lg shadow-xl max-w-full h-auto mx-auto" />}
        {videoUrl && <video controls src={videoUrl} className="rounded-xl shadow-xl w-full max-w-xl mx-auto" />}
      </div>
    </div>
  );
}

export default SmartBar;
