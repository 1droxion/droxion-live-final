import React, { useEffect, useState } from "react";
import axios from "axios";

function Profile() {
  const [avatar, setAvatar] = useState("/avatar.png");
  const [preview, setPreview] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [credits, setCredits] = useState(0);
  const [plan, setPlan] = useState("Starter");
  const [usage, setUsage] = useState({ videos: 0, images: 0, auto: 0 });

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL || "https://droxion-backend.onrender.com"}/user-stats`)
      .then((res) => {
        const stats = res.data;
        setCredits(stats.credits);
        setPlan(stats.plan.name);
        setUsage({
          videos: stats.videosThisMonth,
          images: stats.imagesThisMonth,
          auto: stats.autoGenerates,
        });
      })
      .catch((err) => console.error("Stats load error:", err));
  }, []);

  useEffect(() => {
    const savedName = localStorage.getItem("droxion_name");
    const savedEmail = localStorage.getItem("droxion_email");
    const savedAvatar = localStorage.getItem("droxion_avatar");

    if (savedName) setName(savedName);
    if (savedEmail) setEmail(savedEmail);
    if (savedAvatar) setAvatar(savedAvatar);
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const previewURL = URL.createObjectURL(file);
    setPreview(previewURL);

    const formData = new FormData();
    formData.append("avatar", file);

    axios
      .post(`${import.meta.env.VITE_BACKEND_URL || "https://droxion-backend.onrender.com"}/upload-avatar`, formData)
      .then((res) => {
        const url = `${import.meta.env.VITE_BACKEND_URL || "https://droxion-backend.onrender.com"}${res.data.url}`;
        setAvatar(url);
        localStorage.setItem("droxion_avatar", url);
        window.dispatchEvent(new Event("storage")); // trigger Topbar to refresh avatar
      })
      .catch((err) => {
        console.error("Upload error:", err);
        alert("❌ Avatar upload failed.");
      });
  };

  const handleSave = () => {
    localStorage.setItem("droxion_name", name);
    localStorage.setItem("droxion_email", email);
    alert("✅ Profile saved.");
  };

  return (
    <div className="min-h-screen bg-[#0e0e10] text-white px-6 py-10 flex justify-center">
      <div className="w-full max-w-3xl bg-[#1f2937] p-8 rounded-xl shadow-xl border border-gray-700 space-y-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-green-400">👤 My Profile</h1>

        {/* Avatar Upload */}
        <div className="flex items-center gap-6">
          <img
            src={preview || avatar}
            alt="Avatar"
            className="w-24 h-24 rounded-full object-cover border-4 border-green-500 shadow-lg"
          />
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="text-sm text-gray-300"
            />
            <p className="text-gray-400 text-xs mt-1">Click to upload new avatar</p>
          </div>
        </div>

        {/* Name & Email */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input bg-[#111827] text-white"
          />
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input bg-[#111827] text-white"
          />
        </div>

        <button
          onClick={handleSave}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-green-400 to-blue-500 hover:opacity-90 font-bold text-lg"
        >
          💾 Save Profile
        </button>

        {/* Plan & Usage */}
        <div className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold text-purple-400">📊 Plan Usage</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="bg-[#0e0e10] p-4 rounded-lg border border-green-500">
              💳 <strong>Credits:</strong> {credits}
            </div>
            <div className="bg-[#0e0e10] p-4 rounded-lg border border-purple-500">
              🪙 <strong>Plan:</strong> {plan}
            </div>
            <div className="bg-[#0e0e10] p-4 rounded-lg border border-blue-500">
              🎬 <strong>Videos:</strong> {usage.videos} used
            </div>
            <div className="bg-[#0e0e10] p-4 rounded-lg border border-pink-500">
              🖼️ <strong>Images:</strong> {usage.images} used
            </div>
            <div className="bg-[#0e0e10] p-4 rounded-lg border border-yellow-500">
              ⚡ <strong>Auto Reels:</strong> {usage.auto} used
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
