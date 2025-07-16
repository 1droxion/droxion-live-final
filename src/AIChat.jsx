import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

function AIChat() {
  const [messages, setMessages] = useState([]); // normal order (bottom-first)
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const sendMessage = async (customInput) => {
    const prompt = customInput || input;
    if (!prompt.trim()) return;

    const userMsg = { role: "user", content: prompt };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // image
      if (prompt.toLowerCase().includes("image")) {
        const imgRes = await axios.post("https://droxion-backend.onrender.com/generate-image", {
          prompt,
        });
        const imgUrl = imgRes.data.image_url;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `![Generated Image](${imgUrl})`,
          },
        ]);
      }
      // YouTube
      else if (prompt.toLowerCase().includes("youtube") || prompt.toLowerCase().includes("video")) {
        const ytRes = await axios.post("https://droxion-backend.onrender.com/search-youtube", {
          prompt,
        });
        const ytUrl = ytRes.data.url;
        const title = ytRes.data.title;
        const videoId = ytUrl.split("v=")[1];
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `<b>📺 ${title}</b><br/><iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`,
          },
        ]);
      }
      // chat
      else {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", {
          prompt,
        });
        const reply = res.data.reply;

        const finalReply = reply.replace(
          /(https?:\/\/[^\s]+)/g,
          (url) => `[🔗 ${url}](${url})`
        );

        setMessages((prev) => [...prev, { role: "assistant", content: finalReply }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Error from AI. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const ToolButton = ({ title }) => (
    <button
      onClick={() => sendMessage(title)}
      className="border border-gray-700 bg-black text-white px-3 py-1 rounded-full text-xs hover:bg-white hover:text-black transition"
    >
      {title}
    </button>
  );

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  return (
    <div className="bg-black text-white min-h-screen flex flex-col pt-6">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold text-gray-400 tracking-widest">Droxion</h1>
      </div>

      {/* Before typing */}
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center px-4">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-5 max-w-xl w-full shadow-xl">
            <input
              type="text"
              placeholder="What do you want to know?"
              className="w-full bg-transparent text-white text-sm outline-none mb-4"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="flex flex-wrap gap-2 mb-4">
              <ToolButton title="DeepSearch" />
              <ToolButton title="Think" />
              <ToolButton title="Create Images" />
              <ToolButton title="Research" />
              <ToolButton title="Edit Image" />
              <ToolButton title="Latest News" />
              <ToolButton title="Personas" />
            </div>
            <div className="text-center">
              <button
                onClick={() => sendMessage()}
                disabled={loading}
                className="bg-white text-black text-sm px-4 py-1 rounded-full hover:bg-gray-200 transition"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Replies scroll down */}
          <div className="flex-1 overflow-y-auto px-4 max-w-3xl mx-auto w-full pb-36">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`my-3 text-sm ${
                  msg.role === "user" ? "text-right" : "text-left"
                }`}
              >
                <div
                  className={`inline-block p-3 rounded-xl max-w-full ${
                    msg.role === "user" ? "bg-blue-700" : "bg-[#1a1a1a]"
                  }`}
                >
                  <ReactMarkdown
                    className="prose prose-invert text-sm"
                    rehypePlugins={[rehypeRaw]}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && (
              <div className="my-3 text-left">
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full" />
                  <div className="text-sm text-gray-400 font-mono tracking-widest">
                    <span className="text-gray-500 animate-pulse">✖</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar fixed */}
          <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-2 py-4">
            <div className="flex justify-center mb-2 flex-wrap gap-2 max-w-2xl mx-auto">
              <ToolButton title="DeepSearch" />
              <ToolButton title="Think" />
              <ToolButton title="Create Images" />
              <ToolButton title="Research" />
              <ToolButton title="Edit Image" />
              <ToolButton title="Latest News" />
              <ToolButton title="Personas" />
            </div>
            <div className="flex max-w-2xl mx-auto bg-[#111] rounded-full px-4 py-2 items-center">
              <input
                type="text"
                placeholder="What do you want to know?"
                className="flex-1 bg-transparent text-white text-sm outline-none"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading}
                className="ml-3 px-3 py-1 rounded-full bg-white text-black text-sm hover:bg-gray-300 transition"
              >
                ➤
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AIChat;
