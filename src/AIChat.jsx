import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import {
  FaTrash, FaDownload, FaClock, FaPlus,
  FaVolumeUp, FaVolumeMute, FaVideo, FaMicrophone
} from "react-icons/fa";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [lang, setLang] = useState("en");
  const chatRef = useRef(null);
  const typingInterval = useRef(null);
  const [typingText, setTypingText] = useState("Typing");

  useEffect(() => {
    if (isLoading) {
      let dots = 0;
      typingInterval.current = setInterval(() => {
        setTypingText("Typing" + ".".repeat(dots % 4));
        dots++;
      }, 500);
    } else {
      clearInterval(typingInterval.current);
    }
    return () => clearInterval(typingInterval.current);
  }, [isLoading]);

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleMicInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech recognition not supported.");

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.start();

    recognition.onresult = (event) => {
      const speech = event.results[0][0].transcript;
      setInput(speech);
    };
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const lower = input.toLowerCase();

      if (lower.startsWith("/lang")) {
        const code = lower.split(" ")[1] || "en";
        setLang(code);
        setMessages((prev) => [...prev, {
          role: "assistant", content: `🌐 Language set to: ${code}`
        }]);
        setIsLoading(false);
        return;
      }

      if (lower.startsWith("/img")) {
        const prompt = input.replace("/img", "").trim();
        const image = await axios.post("https://droxion-backend.onrender.com/generate-image", { prompt });
        if (image.data?.image_url) {
          const markdown = `🖼\n\n![image](${image.data.image_url})`;
          setMessages((prev) => [...prev, { role: "assistant", content: markdown }]);
        }
        setIsLoading(false);
        return;
      }

      if (lower.startsWith("/voice")) {
        const text = input.replace("/voice", "").trim();
        const audioRes = await axios.post("https://droxion-backend.onrender.com/speak", { text });
        if (audioRes.data?.url) {
          const audio = new Audio(audioRes.data.url);
          audio.play();
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `🔊 Speaking: "${text}"`
          }]);
        }
        setIsLoading(false);
        return;
      }

      // YouTube smart trigger
      if (lower.includes("video") || lower.includes("watch") || lower.includes("song") || lower.includes("trailer")) {
        const yt = await axios.post("https://droxion-backend.onrender.com/search-youtube", { prompt: input });
        if (yt.data?.url && yt.data?.title) {
          const videoId = yt.data.url.split("v=")[1];
          const markdown = `🎬 **${yt.data.title}**  
🔗 [Watch on YouTube](${yt.data.url})  
<iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
          setMessages((prev) => [...prev, { role: "assistant", content: markdown }]);
          setIsLoading(false);
          return;
        }
      }

      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt: input,
        videoMode: videoMode,
        voiceMode: audioOn,
        language: lang
      });

      const reply = res.data.reply;
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

      if (audioOn) {
        const audioRes = await axios.post("https://droxion-backend.onrender.com/speak", { text: reply });
        if (audioRes.data?.url) {
          const audio = new Audio(audioRes.data.url);
          audio.play();
        }
      }

    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Error: Something went wrong." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleAudio = () => setAudioOn(!audioOn);
  const toggleVideoMode = () => setVideoMode(!videoMode);
  const downloadChat = () => {
    const text = messages.map((m) => `${m.role === "user" ? "You" : "AI"}: ${m.content}`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "chat.txt";
    link.click();
  };
  const clearChat = () => setMessages([]);

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="text-lg font-bold">💬 <span className="text-white">AI Chat (Droxion)</span></div>
        <div className="flex items-center gap-4 text-white text-md">
          <FaClock title="History" />
          <FaPlus title="New" onClick={clearChat} />
          <FaTrash title="Clear" onClick={clearChat} />
          <FaDownload title="Download" onClick={downloadChat} />
          <FaMicrophone title="Mic Input" onClick={handleMicInput} />
          {audioOn ? (
            <FaVolumeUp title="Voice On" onClick={toggleAudio} />
          ) : (
            <FaVolumeMute title="Voice Off" onClick={toggleAudio} />
          )}
          <FaVideo title="Video" onClick={toggleVideoMode} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`max-w-[90%] px-4 py-3 rounded-xl shadow ${msg.role === "user" ? "bg-white text-black ml-auto" : "bg-[#1f1f1f] text-white mr-auto"}`}>
            <ReactMarkdown
              components={{
                iframe: ({ node, ...props }) => (
                  <div className="my-2">
                    <iframe {...props} className="w-full max-w-md rounded-lg" />
                  </div>
                ),
                img: ({ node, ...props }) => (
                  <img {...props} className="rounded-lg my-2 w-[180px] h-auto" />
                ),
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        ))}
        {isLoading && (
          <div className="text-gray-500 italic px-4 py-2">{typingText}</div>
        )}
        <div ref={chatRef} />
      </div>

      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center gap-2 flex-wrap">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type or say anything..."
            className="flex-1 min-w-[250px] bg-[#1a1a1a] text-white p-3 rounded-lg border border-gray-600 focus:outline-none resize-none"
            rows={1}
          />
          <button
            onClick={handleSend}
            className="bg-white hover:bg-gray-200 text-black font-bold py-2 px-4 rounded"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
