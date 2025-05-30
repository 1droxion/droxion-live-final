import React, { useEffect, useState } from "react";
import { Settings2, Volume2, Bell } from "lucide-react";

function Settings() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toastEnabled, setToastEnabled] = useState(true);

  useEffect(() => {
    const soundPref = localStorage.getItem("droxion_sound");
    const toastPref = localStorage.getItem("droxion_toast");

    if (soundPref !== null) setSoundEnabled(soundPref === "true");
    if (toastPref !== null) setToastEnabled(toastPref === "true");
  }, []);

  const handleToggle = (setting, setFunc, key) => {
    const newValue = !setting;
    setFunc(newValue);
    localStorage.setItem(key, newValue);
  };

  return (
    <div className="min-h-screen bg-[#0e0e10] flex items-center justify-center px-4 py-12 text-white">
      <div className="w-full max-w-md bg-[#1e293b] border border-gray-700 rounded-2xl shadow-xl p-8 space-y-8 relative overflow-hidden">

        <div className="absolute top-4 right-4 animate-pulse text-green-400">
          <Settings2 size={28} />
        </div>

        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-green-400 via-lime-400 to-green-500 text-transparent bg-clip-text text-center">
          ⚙️ System Settings
        </h1>

        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-gray-600 pb-4">
            <div className="flex items-center gap-3">
              <Volume2 className="text-green-400" />
              <span className="text-lg">Sound Effects</span>
            </div>
            <button
              onClick={() => handleToggle(soundEnabled, setSoundEnabled, "droxion_sound")}
              className={`w-20 py-1 rounded-full text-sm font-semibold shadow transition ${
                soundEnabled
                  ? "bg-green-500 hover:bg-green-600"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              {soundEnabled ? "On" : "Off"}
            </button>
          </div>

          <div className="flex items-center justify-between border-b border-gray-600 pb-4">
            <div className="flex items-center gap-3">
              <Bell className="text-yellow-300" />
              <span className="text-lg">Toast Notifications</span>
            </div>
            <button
              onClick={() => handleToggle(toastEnabled, setToastEnabled, "droxion_toast")}
              className={`w-20 py-1 rounded-full text-sm font-semibold shadow transition ${
                toastEnabled
                  ? "bg-green-500 hover:bg-green-600"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              {toastEnabled ? "On" : "Off"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
