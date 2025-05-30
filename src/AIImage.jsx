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

  const projectOptions = [...new Set(history.map((item) => item.project))];

  return (
    <div className="p-6 max-w-5xl mx-auto text-[var(--text)] animate-fade-in">
      <h1 className="text-5xl font-bold text-center bg-gradient-to-r from-green-400 via-blue-400 to-purple-500 text-transparent bg-clip-text mb-10">
        🎨 Create Stunning AI Images
      </h1>
      {/* ...rest unchanged... */}
    </div>
  );
}

export default AIImage;
