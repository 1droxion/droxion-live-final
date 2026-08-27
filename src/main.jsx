import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import ShortFeedPlaybackEnhancer from "./ShortFeedPlaybackEnhancer.jsx";
import LiveCameraStartupEnhancer from "./LiveCameraStartupEnhancer.jsx";
import "./index.css";
import "./responsive-overrides.css";

const isLiveV2Path = window.location.pathname.startsWith('/live-v2');

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      {!isLiveV2Path && <ShortFeedPlaybackEnhancer />}
      {!isLiveV2Path && <LiveCameraStartupEnhancer />}
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
