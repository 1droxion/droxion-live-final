import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

function Profile() {
  const navigate = useNavigate();

  const stored = JSON.parse(localStorage.getItem("droxion_user")) || {
    username: "Dhruv",
    email: "",
    password: "",
    credits: 5,
  };

  const [username, setUsername] = useState(stored.username);
  const [email, setEmail] = useState(stored.email);
  const [password, setPassword] = useState(stored.password);
  const [showPassword, setShowPassword] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [credits, setCredits] = useState(stored.credits || 0);

  useEffect(() => {
    const storedAvatar = localStorage.getItem("droxion_avatar");
    if (storedAvatar) setAvatar(storedAvatar);
  }, []);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatar(url);
      localStorage.setItem("droxion_avatar", url);
    }
  };

  const handleSave = () => {
    const updatedUser = { username, email, password, credits };
    localStorage.setItem("droxion_user", JSON.stringify(updatedUser));
    alert("✅ Profile updated");
  };

  const handleLogout = () => {
    localStorage.removeItem("droxion_user");
    localStorage.removeItem("droxion_avatar");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-black via-[#0f172a] to-black flex items-center justify-center px-4 py-10 text-white">
      <div className="w-full max-w-3xl bg-[#1e1e2f] border border-green-500 rounded-3xl shadow-[0_0_30px_rgba(0,255,127,0.4)] p-10 space-y-8 relative overflow-hidden">
        <div className="absolute top-4 right-4 text-green-400 animate-pulse">
          <Sparkles size={28} />
        </div>

        <h1 className="text-4xl font-extrabold text-center bg-gradient-to-r from-green-400 to-teal-500 text-transparent bg-clip-text">
          ✨ My Futuristic Profile
        </h1>

        <div className="text-center text-sm text-gray-400">
          🎟️ <span className="font-bold text-green-300">{credits}</span> credits remaining
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <img
              src={
                avatar ||
                `https://ui-avatars.com/api/?name=${username}&background=0D8ABC&color=fff`
              }
              alt="Avatar"
              className="w-28 h-28 rounded-full object-cover border-4 border-green-400 shadow-lg transform group-hover:scale-105 transition"
            />
            <label className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs text-white bg-black bg-opacity-60 px-2 py-0.5 rounded cursor-pointer">
              Change
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-300 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pr-20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-600"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-6">
          <button
            onClick={handleLogout}
            className="bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 px-4 py-2 rounded-lg font-medium text-sm transition shadow-md"
          >
            🔓 Logout
          </button>
          <button
            onClick={handleSave}
            className="bg-gradient-to-br from-green-400 to-lime-500 hover:from-green-500 hover:to-green-600 px-6 py-2 rounded-xl font-semibold shadow-xl text-black transform hover:scale-105 transition-all"
          >
            💾 Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;
