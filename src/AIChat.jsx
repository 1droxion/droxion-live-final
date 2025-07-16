// AIChat.jsx
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { FaPlay } from "react-icons/fa";

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setHasInteracted(true);
    setInput("");

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt: input,
        voiceMode: false,
      });
      const botReply = res.data.reply;
      setMessages((prev) => [...prev, { role: "bot", content: botReply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "bot", content: "❌ Something went wrong. Try again." },
      ]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderContent = (content) => {
    if (content?.includes("<iframe")) {
      return <div dangerouslySetInnerHTML={{ __html: content }} />;
    }
    if (content?.includes(".jpg") || content?.includes(".png")) {
      return <img src={content} alt="Generated" className="rounded-xl mt-2" />;
    }
    if (content?.includes("youtube.com") || content?.includes("youtu.be")) {
      const urlMatch = content.match(/https?:\/\/(?:www\.)?(youtube\.com\S+|youtu\.be\S+)/);
      if (urlMatch) {
        let videoId = "";
        try {
          const url = new URL(urlMatch[0]);
          videoId = url.searchParams.get("v") || url.pathname.replace("/", "");
        } catch {}
        if (videoId)
          return (
            <iframe
              width="100%"
              height="240"
              className="rounded-xl mt-2"
              src={`https://www.youtube.com/embed/${videoId}`}
              frameBorder="0"
              allowFullScreen
            ></iframe>
          );
      }
    }
    return (
      <ReactMarkdown rehypePlugins={[rehypeRaw]} className="prose prose-invert">
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <div className="bg-black min-h-screen text-white flex flex-col">
      <h1 className="text-center text-3xl font-semibold pt-6 pb-4 text-gray-300">
        Droxion
      </h1>

      {!hasInteracted ? (
        <div className="flex flex-col items-center justify-center flex-1">
          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl">
            <p className="text-lg mb-4 text-gray-300">What do you want to know?</p>
            <div className="flex flex-wrap gap-3 justify-center">
              {["DeepSearch", "Think", "Create Images", "Research", "Edit Image", "Latest News", "Personas"].map(
                (btn) => (
                  <button
                    key={btn}
                    onClick={() => {
                      setInput(btn);
                      sendMessage();
                    }}
                    className="border border-gray-500 rounded-full px-4 py-1 text-sm hover:bg-gray-700"
                  >
                    {btn}
                  </button>
                )
              )}
            </div>
            <button
              onClick={sendMessage}
              className="bg-white text-black mt-6 mx-auto rounded-full p-3"
            >
              <FaPlay />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28">
          <div className="max-w-2xl mx-auto">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`my-4 p-3 rounded-xl max-w-xl text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-700 text-white self-end ml-auto text-right"
                    : "bg-zinc-800 text-white"
                }`}
              >
                {renderContent(msg.content)}
              </div>
            ))}
            {loading && <div className="text-center text-gray-400">Thinking...</div>}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      <div className="fixed bottom-4 left-0 right-0 px-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <textarea
            className="flex-1 p-3 rounded-full bg-zinc-800 border border-zinc-600 text-white placeholder-gray-400 resize-none"
            rows={1}
            placeholder="Ask anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={sendMessage}
            className="bg-white text-black p-3 rounded-full hover:bg-gray-200"
          >
            <FaPlay />
          </button>
        </div>
      </div>
    </div>
  );
}
