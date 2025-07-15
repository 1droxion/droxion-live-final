const handleSend = async (textToSend = input) => {
  if (!textToSend.trim()) return;
  const userMsg = { role: "user", content: textToSend };
  setMessages(prev => [...prev, userMsg]);
  setInput("");
  setTyping(true);
  logAction("message", textToSend);

  try {
    const lower = textToSend.toLowerCase();
    const ytKW = ["video", "watch", "trailer", "movie", "song", "youtube"];
    const imgKW = ["image", "picture", "draw", "photo", "create", "generate"];
    let handled = false;

    if (ytKW.some(k => lower.includes(k))) {
      const yt = await axios.post("https://droxion-backend.onrender.com/search-youtube", { prompt: textToSend });
      if (yt.data?.url) {
        const vid = yt.data.url.split("v=")[1];
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `<iframe class='rounded-lg my-2 max-w-xs' width='360' height='203' src='https://www.youtube.com/embed/${vid}' allowFullScreen></iframe>`
        }]);
        handled = true;
      }
    }

    if (!handled && imgKW.some(k => lower.includes(k))) {
      const im = await axios.post("https://droxion-backend.onrender.com/generate-image", { prompt: textToSend });
      if (im.data?.image_url) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `![Generated Image](${im.data.image_url})`
        }]);
        handled = true;
      }
    }

    if (!handled && lower.startsWith("weather in ")) {
      const city = textToSend.slice(11).trim();
      const w = await axios.post("https://droxion-backend.onrender.com/realtime/weather", { city });
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `**🌦️ Weather in ${w.data.city}:**\n${w.data.temp}, ${w.data.condition}`
      }]);
      handled = true;
    }

    if (!handled && lower.startsWith("news about ")) {
      const topic = textToSend.slice(11).trim();
      const n = await axios.post("https://droxion-backend.onrender.com/realtime/news", { topic });
      const hl = Array.isArray(n.data.headlines) ? n.data.headlines : [];
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `**📰 Top News on ${topic}:**\n` + hl.map(h => `• ${h}`).join("\n")
      }]);
      handled = true;
    }

    if (!handled && lower.startsWith("stock price of ")) {
      const ticker = textToSend.slice(15).trim().toUpperCase();
      const s = await axios.post("https://droxion-backend.onrender.com/realtime/stock", { ticker });
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `**📈 ${s.data.ticker}:** ${s.data.price} (${s.data.change})`
      }]);
      handled = true;
    }

    if (!handled && lower.includes("time in ")) {
      const city = textToSend.split("time in ")[1].trim();
      const t = await axios.post("https://droxion-backend.onrender.com/realtime/time", { city });
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `**⏰ Current Time in ${t.data.city}:** ${t.data.time}`
      }]);
      handled = true;
    }

    if (!handled && lower.includes("time now")) {
      const t = await axios.post("https://droxion-backend.onrender.com/realtime/time", { city: "your city or empty" });
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `**⏰ Current Time:** ${t.data.time} (${t.data.city})`
      }]);
      handled = true;
    }

    if (!handled && lower.includes("date today")) {
      const now = new Date().toLocaleDateString("en-US", { dateStyle: "full" });
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `📅 Today's date is: **${now}**`
      }]);
      handled = true;
    }

    if (!handled) {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt: textToSend,
        voiceMode
      });
      let reply = res.data.reply;
      if (/who.*(made|created)/i.test(textToSend)) {
        reply = "I was created and managed by **Dhruv Patel**, powered by OpenAI.";
      }
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      speak(reply);
    }
  } catch {
    setMessages(prev => [...prev, { role: "assistant", content: "❌ Error: Something went wrong." }]);
  } finally {
    setTyping(false);
  }
};