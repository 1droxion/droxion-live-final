import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

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
    <div className="min-h-screen bg-[#0e0e10] flex items-center justify-center px-4 py-10 text-white">
      <div className="w-full max-w-2xl bg-[#1f2937] border border-gray-700 rounded-2xl shadow-xl p-8 space-y-6">
        <h1 className="text-3xl font-bold text-center text-green-400">👤 My Profile</h1>

        {/* Credits Display */}
        <div className="text-center text-sm text-gray-400">
          🎟️ <span className="font-bold text-white">{credits}</span> credits remaining
        </div>

        {/* Avatar Upload */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <img
              src={
                avatar ||
                `https://ui-avatars.com/api/?name=${username}&background=0D8ABC&color=fff`
              }
              alt="Avatar"
              className="w-28 h-28 rounded-full object-cover border-4 border-green-500 shadow-md group-hover:scale-105 transition"
            />
            <label className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs text-white bg-black bg-opacity-50 px-2 py-0.5 rounded cursor-pointer">
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

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1 text-gray-300">Password</label>
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

        {/* Buttons */}
        <div className="flex justify-between items-center pt-4">
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg font-medium text-sm transition"
          >
            🔓 Logout
          </button>
          <button
            onClick={handleSave}
            className="bg-green-500 hover:bg-green-600 px-6 py-2 rounded-lg font-semibold shadow-md transition transform hover:scale-105 flex items-center gap-2"
          >
            💾 Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;
