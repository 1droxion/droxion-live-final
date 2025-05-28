import React, { useEffect, useState } from "react";

function Settings() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toastEnabled, setToastEnabled] = useState(true);

  useEffect(() => {
    const soundPref = localStorage.getItem("droxion_sound");
    const toastPref = localStorage.getItem("droxion_toast");

    if (soundPref !== null) setSoundEnabled(soundPref === "true");
    if (toastPref !== null) setToastEnabled(toastPref === "true");
  }, []);

  const handleSoundToggle = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem("droxion_sound", newValue);
  };

  const handleToastToggle = () => {
    const newValue = !toastEnabled;
    setToastEnabled(newValue);
    localStorage.setItem("droxion_toast", newValue);
  };

  return (
    <div className="p-4 text-white">
      <h2 className="text-2xl font-semibold mb-4">Settings</h2>

      <div className="mb-4 flex items-center justify-between">
        <span>🔊 Sound Effects</span>
        <button
          onClick={handleSoundToggle}
          className={`px-4 py-1 rounded ${
            soundEnabled ? "bg-green-600" : "bg-gray-600"
          }`}
        >
          {soundEnabled ? "On" : "Off"}
        </button>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <span>🔔 Toast Notifications</span>
        <button
          onClick={handleToastToggle}
          className={`px-4 py-1 rounded ${
            toastEnabled ? "bg-green-600" : "bg-gray-600"
          }`}
        >
          {toastEnabled ? "On" : "Off"}
        </button>
      </div>
    </div>
  );
}

export default Settings;
