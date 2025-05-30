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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0e0e10] to-[#1f1f27] text-white px-6 py-8">
      <h1 className="text-center text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-blue-400 to-purple-500 mb-10 animate-pulse">
        🪄 Create Stunning AI Images
      </h1>

      <div className="flex flex-col md:flex-row gap-6 max-w-5xl mx-auto">
        <div className="flex-1 space-y-4">
          <input
            type="text"
            placeholder="Describe an epic image..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="input bg-[#1f2937] border border-gray-700"
          />
          <button
            onClick={generateImage}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-3 rounded-xl"
          >
            {loading ? "🎨 Generating..." : "🎨 Generate"}
          </button>
          <button
            onClick={suggestPrompt}
            className="w-full text-sm text-purple-400 hover:underline"
          >
            ✨ Suggest Random Prompt
          </button>
        </div>

        <div className="flex-1 text-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Generated"
              className="mx-auto rounded-xl shadow-lg border border-purple-600 transition duration-500 hover:scale-105"
            />
          ) : (
            <div className="text-gray-500 italic mt-16">Image preview will appear here...</div>
          )}

          {imageUrl && (
            <div className="mt-4">
              <a
                href={imageUrl}
                download
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
              >
                ⬇️ Download Image
              </a>
            </div>
          )}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="mt-8 text-center">
          <p className="mb-2 text-lg font-semibold">🌟 Tags</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {tags.map((tag, i) => (
              <span key={i} className="bg-gray-700 px-3 py-1 rounded-full text-sm text-white">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AIImage;
