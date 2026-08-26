import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./liveStartupRaceGuard.js";
import App from "./App.jsx";
import ShortFeedPlaybackEnhancer from "./ShortFeedPlaybackEnhancer.jsx";
import LiveCameraStartupEnhancer from "./LiveCameraStartupEnhancer.jsx";
import "./index.css";
import "./responsive-overrides.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ShortFeedPlaybackEnhancer />
      <LiveCameraStartupEnhancer />
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
