import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import ShortFeedPlaybackEnhancer from "./ShortFeedPlaybackEnhancer.jsx";
import LiveCameraStartupEnhancer from "./LiveCameraStartupEnhancer.jsx";
import AdReadyEnhancer from "./AdReadyEnhancer.jsx";
import NativeExternalLivePlayerBridge from "./NativeExternalLivePlayerBridge.jsx";
import "./index.css";
import "./responsive-overrides.css";
import "./profile-polish.css";
import "./navigation-v2.css";
import "./creator-auto-video.css";

const isLiveV2Path = window.location.pathname.startsWith('/live-v2');
const isNativeLivePlayerPath = window.location.pathname === '/native-live-player';

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      {!isLiveV2Path && !isNativeLivePlayerPath && <ShortFeedPlaybackEnhancer />}
      {!isLiveV2Path && !isNativeLivePlayerPath && <LiveCameraStartupEnhancer />}
      {!isLiveV2Path && !isNativeLivePlayerPath && <AdReadyEnhancer />}
      {!isNativeLivePlayerPath && <NativeExternalLivePlayerBridge />}
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
