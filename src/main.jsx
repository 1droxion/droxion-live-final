import React from "react";
import { createRoot } from "react-dom/client";
import AIChat from "./AIChat.jsx";
import "./index.css"; // <-- important

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AIChat />
  </React.StrictMode>
);