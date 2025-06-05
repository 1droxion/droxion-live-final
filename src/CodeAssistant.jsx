import React, { useState } from "react";
import axios from "./api/axios"; // ✅ use shared axios instance
import { Loader2, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function CodeAssistant() {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setOutput("");
    try {
      const res = await axios.post("/generate-code", { prompt }); // ✅ uses base URL
      setOutput(res.data.code || "⚠️ No response from server.");
    } catch (err) {
      console.error("❌ Code Generation Failed", err);
      setOutput("⚠️ Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4 text-green-400">💡 AI Code Assistant</h1>

      <textarea
        rows="4"
        placeholder="Describe what you want to build... (e.g. 'Create a React login form with TailwindCSS')"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full p-4 rounded-lg bg-[#1e1e1e] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 placeholder:text-gray-400 transition mb-4"
      ></textarea>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-2 rounded-lg shadow-md transition disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="animate-spin" size={18} />
            Generating...
          </span>
        ) : (
          "Generate Code"
        )}
      </button>

      {output && (
        <div className="mt-6 relative bg-[#0e0e10] border border-gray-700 rounded-lg p-4">
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 text-gray-400 hover:text-white"
            title="Copy to clipboard"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>

          <ReactMarkdown
            children={output}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    children={String(children).replace(/\n$/, "")}
                    {...props}
                  />
                ) : (
                  <code className="bg-gray-800 text-green-400 px-1 py-0.5 rounded text-sm">
                    {children}
                  </code>
                );
              },
            }}
          />
        </div>
      )}
    </div>
  );
}

export default CodeAssistant;
