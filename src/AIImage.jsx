import React, { useState, useEffect } from "react";
import axios from "axios";

function AIImage() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [project, setProject] = useState("General");
  const [customProject, setCustomProject] = useState("");

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("droxion_image_history")) || [];
    setHistory(stored);
  }, []);

  const saveToHistory = (newItem) => {
    const updated = [newItem, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem("droxion_image_history", JSON.stringify(updated));
  };

  const deleteFromHistory = (index) => {
    const updated = [...history];
    updated.splice(index, 1);
    setHistory(updated);
    localStorage.setItem("droxion_image_history", JSON.stringify(updated));
  };

  const handleLike = (index) => {
    const updated = [...history];
    updated[index].likes = (updated[index].likes || 0) + 1;
    setHistory(updated);
    localStorage.setItem("droxion_image_history", JSON.stringify(updated));
  };

  const handleDownload = (index) => {
    const updated = [...history];
    updated[index].downloads = (updated[index].downloads || 0) + 1;
    setHistory(updated);
    localStorage.setItem("droxion_image_history", JSON.stringify(updated));
  };

  const generateImage = async () => {
    const user = JSON.parse(localStorage.getItem("droxion_user"));
    if (!user || user.credits < 1) {
      alert("❌ Not enough credits. Please upgrade your plan.");
      return;
    }

    if (!prompt.trim()) {
      alert("Please enter a prompt.");
      return;
    }

    const projectToSave = customProject || project;

    setLoading(true);
    setImageUrl("");
    setTags([]);

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

      // Generate tags using GPT
      const tagResponse = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "Extract 3 short style tags from this image prompt. Return as comma-separated lowercase hashtags.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const tagText = tagResponse.data.choices[0].message.content.trim();
      const tagArray = tagText.split(",").map((t) => t.trim());
      setTags(tagArray);

      user.credits -= 1;
      localStorage.setItem("droxion_user", JSON.stringify(user));

      saveToHistory({
        prompt,
        url,
        tags: tagArray,
        time: new Date().toISOString(),
        project: projectToSave,
        likes: 0,
        downloads: 0,
      });
    } catch (err) {
      console.error("❌ Error:", err.response?.data || err.message);
      alert("Image generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const suggestPrompt = async () => {
    setSuggesting(true);
    try {
      const res = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "Suggest a creative prompt for generating a cool AI image. Keep it under 20 words.",
            },
            {
              role: "user",
              content: "Suggest a prompt.",
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const suggestion = res.data.choices[0].message.content.trim();
      setPrompt(suggestion);
    } catch (err) {
      console.error("❌ Prompt Suggestion Error:", err.response?.data || err.message);
      alert("Failed to suggest prompt.");
    } finally {
      setSuggesting(false);
    }
  };

  const projectOptions = [...new Set(history.map((item) => item.project))];

  return (
    <div className="p-6 max-w-5xl mx-auto text-[var(--text)]">
      <h1 className="text-3xl font-bold text-center text-green-400 mb-6">🎨 AI Image Generator</h1>

      {/* Style Presets */}
      <div className="flex flex-wrap gap-3 justify-center mb-4">
        {["Pixel Art", "Anime Style", "3D Render", "Ghibli Style", "Cyberpunk", "Cartoon"].map((style) => (
          <button
            key={style}
            onClick={() => {
              setSelectedStyle(style);
              setPrompt(`${style} of a futuristic city with neon lights`);
            }}
            className={`px-4 py-2 rounded text-sm border transition ${
              selectedStyle === style
                ? "bg-green-600 border-green-500 text-white"
                : "bg-gray-800 hover:bg-gray-700 border-gray-600"
            }`}
          >
            {style}
          </button>
        ))}
      </div>

      {/* Suggest Prompt + Project Selector */}
      <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-6">
        <button
          onClick={suggestPrompt}
          disabled={suggesting}
          className="bg-yellow-500 hover:bg-yellow-600 text-black px-5 py-2 rounded-lg font-semibold transition"
        >
          {suggesting ? "✨ Thinking..." : "🔮 Suggest Prompt"}
        </button>

        <select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="bg-gray-800 border border-gray-600 rounded px-4 py-2 text-sm"
        >
          <option value="General">📁 General</option>
          {projectOptions.map((proj, idx) => (
            proj !== "General" && <option key={idx}>{proj}</option>
          ))}
        </select>

        <input
          type="text"
          value={customProject}
          onChange={(e) => setCustomProject(e.target.value)}
          placeholder="New folder name..."
          className="px-3 py-2 rounded bg-gray-700 text-white text-sm"
        />
      </div>

      {/* Prompt Input */}
      <div className="bg-[#1f2937] p-6 rounded-xl border border-gray-700 shadow-lg mb-10">
        <label className="block text-lg font-semibold mb-2">Prompt</label>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want..."
          className="w-full p-3 rounded text-black mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={generateImage}
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-600 py-3 rounded-lg font-bold transition-all"
        >
          {loading ? "🎨 Generating..." : "🎨 Generate Image"}
        </button>
      </div>

      {/* Generated Image */}
      {imageUrl && (
        <div className="mb-10 flex flex-col items-center gap-4">
          <img
            src={imageUrl}
            alt="AI Output"
            className="max-w-full max-h-[500px] rounded-xl shadow-lg border border-gray-700"
          />
          <div className="flex gap-2 flex-wrap justify-center text-sm text-gray-400">
            {tags.map((tag, idx) => (
              <span key={idx} className="bg-gray-700 px-2 py-1 rounded-full">#{tag}</span>
            ))}
          </div>
          <a
            href={imageUrl}
            download
            className="bg-purple-600 hover:bg-purple-700 px-5 py-2 rounded-lg font-semibold transition"
          >
            ⬇️ Download Image
          </a>
        </div>
      )}

      {/* Image History */}
      {history.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">🕘 Recent Generations</h2>
            <button
              onClick={() => {
                setHistory([]);
                localStorage.removeItem("droxion_image_history");
              }}
              className="text-sm bg-red-600 hover:bg-red-700 px-4 py-1 rounded text-white transition"
            >
              🗑️ Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {history.map((item, i) => (
              <div key={i} className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-700 shadow">
                <img
                  src={item.url}
                  alt="History"
                  className="w-full h-48 object-cover rounded mb-3 transform hover:scale-105 transition duration-300"
                />
                <p className="text-sm text-gray-300 mb-1 truncate">📝 {item.prompt}</p>
                {item.tags && (
                  <div className="flex gap-2 flex-wrap mb-2 text-xs text-gray-400">
                    {item.tags.map((t, j) => (
                      <span key={j} className="bg-gray-700 px-2 py-0.5 rounded-full">#{t}</span>
                    ))}
                  </div>
                )}
                <div className="text-xs text-gray-500 mb-2">📁 {item.project || "General"}</div>
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                  <button onClick={() => handleLike(i)}>❤️ {item.likes || 0}</button>
                  <span>⬇️ {item.downloads || 0}</span>
                </div>
                <div className="flex justify-between">
                  <a
                    href={item.url}
                    download
                    onClick={() => handleDownload(i)}
                    className="bg-gray-700 hover:bg-gray-600 text-sm px-3 py-1 rounded text-white"
                  >
                    ⬇️ Download
                  </a>
                  <button
                    onClick={() => deleteFromHistory(i)}
                    className="bg-red-600 hover:bg-red-700 text-sm px-3 py-1 rounded text-white"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AIImage;
