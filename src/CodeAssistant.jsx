import React, { useState } from "react";
import axios from "axios";

function CodeAssistant() {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setOutput("");

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL || "https://droxion-backend1.onrender.com"}/generate-code`,
        { prompt }
      );
      setOutput(res.data.code);
    } catch (err) {
      console.error("❌ Error generating code:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 min-h-screen bg-[#0e0e10] text-white">
      <h1 className="text-3xl font-bold mb-6 text-center text-green-400">💻 Droxion Code Assistant</h1>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What do you want to build? e.g. 'todo app in React'"
          className="flex-grow p-4 bg-[#1f2937] rounded-lg border border-gray-700 placeholder-gray-400"
        />
        <button
          onClick={handleGenerate}
          disabled={loading}
          className={`px-6 py-3 rounded-lg font-bold transition ${
            loading ? "bg-gray-500 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {loading ? "Generating..." : "Generate Code"}
        </button>
      </div>

      {output && (
        <div className="bg-[#111827] p-5 rounded-lg border border-gray-800 overflow-x-auto">
          <h2 className="text-lg text-green-300 font-semibold mb-2">🧩 Result</h2>
          <pre className="text-sm whitespace-pre-wrap text-white">
            <code>{output}</code>
          </pre>
          <button
            className="mt-4 text-blue-400 hover:underline text-sm"
            onClick={() => navigator.clipboard.writeText(output)}
          >
            📋 Copy All Code
          </button>
        </div>
      )}
    </div>
  );
}

export default CodeAssistant;
