import React, { useEffect, useState } from "react";
import { Settings as SettingsIcon, Bell, Volume2, LogOut } from "lucide-react";

function Settings() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toastEnabled, setToastEnabled] = useState(true);
  const [user, setUser] = useState({ username: "Guest", email: "guest@droxion.com" });

  useEffect(() => {
    const soundPref = localStorage.getItem("droxion_sound");
    const toastPref = localStorage.getItem("droxion_toast");
    if (soundPref !== null) setSoundEnabled(soundPref === "true");
    if (toastPref !== null) setToastEnabled(toastPref === "true");

    try {
      const storedUser = localStorage.getItem("droxion_user");
      if (storedUser) setUser(JSON.parse(storedUser));
    } catch (err) {
      console.warn("⚠️ Invalid user data.");
    }
  }, []);

  const handleSoundToggle = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    localStorage.setItem("droxion_sound", newVal);
  };

  const handleToastToggle = () => {
    const newVal = !toastEnabled;
    setToastEnabled(newVal);
    localStorage.setItem("droxion_toast", newVal);
  };

  const handleLogout = () => {
    localStorage.removeItem("droxion_user");
    localStorage.removeItem("droxion_token");
    window.location.reload();
  };

  return (
    <div className="min-h-screen p-6 text-white bg-[#0f172a]">
      <h1 className="text-3xl font-bold text-purple-400 mb-6 flex items-center gap-2">
        <SettingsIcon /> Settings
      </h1>

      <div className="bg-[#111827] rounded-xl p-6 shadow-xl border border-gray-800 space-y-6 max-w-xl">
        {/* Profile Info */}
        <div>
          <h2 className="text-sm text-gray-400 mb-1">👤 Username</h2>
          <p className="text-lg font-bold">{user.username}</p>
          <h2 className="text-sm text-gray-400 mt-4 mb-1">📧 Email</h2>
          <p className="text-md">{user.email}</p>
        </div>

        {/* Sound Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volume2 className="text-green-400" />
            <span className="text-base">Enable Sound</span>
          </div>
          <button
            onClick={handleSoundToggle}
            className={`w-14 h-8 flex items-center rounded-full p-1 transition ${
              soundEnabled ? "bg-green-500" : "bg-gray-600"
            }`}
          >
            <div
              className={`bg-white w-6 h-6 rounded-full shadow transform transition-transform ${
                soundEnabled ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Toast Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="text-yellow-400" />
            <span className="text-base">Enable Toast Alerts</span>
          </div>
          <button
            onClick={handleToastToggle}
            className={`w-14 h-8 flex items-center rounded-full p-1 transition ${
              toastEnabled ? "bg-yellow-400" : "bg-gray-600"
            }`}
          >
            <div
              className={`bg-white w-6 h-6 rounded-full shadow transform transition-transform ${
                toastEnabled ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Logout */}
        <div className="pt-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-red-400 hover:text-red-500 transition font-bold"
          >
            <LogOut /> Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
