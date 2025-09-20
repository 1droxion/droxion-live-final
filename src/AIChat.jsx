Nice! I cleaned up your component so it’s easier to use, looks a bit sleeker on mobile, and adds a few quality-of-life features:
	•	Inline toast errors (no alert() popups)
	•	Preset prompt chips (one-tap)
	•	Brush size slider + Clear Mask for inpaint
	•	Better loading state + image/result cards
	•	Safer upload (optional downscale very large images to keep requests fast)
	•	Small UX hints that change by mode

Drop this in as src/AIChat.jsx (it’s a full replacement).

// src/AIChat.jsx — Droxion (quick image edit MVP: upload + prompt → Remix / Inpaint / BG Swap)
import React, { useRef, useState, useEffect } from "react";
import axios from "axios";

// === change this if needed ===
const API_BASE = "https://droxion-backend.onrender.com";

// simple toast
function useToast() {
  const [toast, setToast] = useState(null);
  function show(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }
  return { toast, show };
}

// small helper: file → base64, with optional max width to keep requests small
async function fileToBase64(file, maxW = 1600) {
  const b64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  // downscale (keeps aspect) if huge
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width > maxW ? maxW / img.width : 1;
      if (scale >= 1) return resolve(b64);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.92));
    };
    img.src = b64;
  });
}

export default function AIChat() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Upload a photo, write a prompt, pick a mode, then Create." }
  ]);

  // editor state
  const [mode, setMode] = useState("remix"); // remix | inpaint | bg
  const [styleStrength, setStyleStrength] = useState(0.6); // remix-only
  const [prompt, setPrompt] = useState("");
  const [imageB64, setImageB64] = useState(null);
  const [maskB64, setMaskB64] = useState(null);
  const [loading, setLoading] = useState(false);

  // inpaint brush
  const [brush, setBrush] = useState(18);

  // file input
  const fileRef = useRef(null);
  const { toast, show } = useToast();

  function pickFile() {
    fileRef.current?.click();
  }

  async function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const b64 = await fileToBase64(f);
    setImageB64(b64);
    setMaskB64(null);
  }

  // --- Inpaint mask canvas ---
  function MaskCanvas({ base, size = brush, onChange }) {
    const cRef = useRef(null);
    const [drawing, setDrawing] = useState(false);

    useEffect(() => {
      if (!base) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = cRef.current;
        const maxW = Math.min(900, window.innerWidth - 24);
        const scale = Math.min(1, maxW / img.width);
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext("2d");
        // start with black mask (keep everything)
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, c.width, c.height);
        onChange(c.toDataURL("image/png"));
      };
      img.src = base;
    }, [base, onChange]);

    function drawAt(clientX, clientY) {
      const c = cRef.current;
      const rect = c.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "white"; // white = edit area
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      onChange(c.toDataURL("image/png"));
    }

    function start(e) {
      setDrawing(true);
      const p = "touches" in e ? e.touches[0] : e;
      drawAt(p.clientX, p.clientY);
    }
    function move(e) {
      if (!drawing) return;
      const p = "touches" in e ? e.touches[0] : e;
      drawAt(p.clientX, p.clientY);
    }
    function end() {
      setDrawing(false);
    }

    function clearMask() {
      const c = cRef.current;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, c.width, c.height);
      onChange(c.toDataURL("image/png"));
    }

    return (
      <div className="block">
        <div className="mask-row">
          <label className="lbl">Mask (white = change, black = keep)</label>
          <div className="mask-tools">
            <label className="lbl tiny">Brush: {size}px</label>
            <input
              type="range"
              min="6"
              max="60"
              step="2"
              value={size}
              onChange={(e) => setBrush(parseInt(e.target.value, 10))}
            />
            <button className="btn" onClick={clearMask}>Clear Mask</button>
          </div>
        </div>

        <canvas
          ref={cRef}
          className="mask"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
        <p className="hint">Brush only the jacket (or area to change). Leave face/background black to preserve them.</p>
      </div>
    );
  }

  // quick presets (tap to insert / replace)
  const presets = {
    remix: [
      "soft cinematic portrait, dreamy lighting, 85mm, ultra realistic",
      "studio portrait, softbox lighting, subtle film grain",
      "fashion magazine cover, dramatic shadows, rim lighting"
    ],
    inpaint: [
      "replace jacket with a plain black t-shirt, keep face and background unchanged, realistic style",
      "remove logo and clean up fabric, keep everything else identical",
      "fix reflection and remove smudges on mirror, natural look"
    ],
    bg: [
      "on a beach at golden hour, cinematic lighting",
      "inside a cozy coffee shop, shallow depth of field",
      "night city lights, neon bokeh"
    ]
  };

  // --- submit ---
  async function createImage() {
    if (!imageB64) return show("Please upload an image first.");
    if (!prompt.trim() && mode !== "bg") return show("Please write a prompt.");

    try {
      setLoading(true);

      let path = "/remix-image";
      let payload = { image_base64: imageB64, prompt };

      if (mode === "remix") {
        payload.style_strength = styleStrength;
      } else if (mode === "inpaint") {
        path = "/inpaint-image";
        if (!maskB64) return show("Please paint a mask (white = change).");
        payload.mask_base64 = maskB64;
      } else if (mode === "bg") {
        path = "/bg-swap";
      }

      const { data } = await axios.post(`${API_BASE}${path}`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (!data?.ok || !data.images?.length) {
        throw new Error(data?.error || "No image returned.");
      }

      const imgs = data.images.map((u, i) => ({ u, i }));
      setMessages((m) => [
        ...m,
        { role: "user", text: `Mode: ${mode} — "${prompt || "(no prompt)"}"` },
        { role: "assistant", images: imgs }
      ]);
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || "Something went wrong.";
      // common backend errors translated for users
      if