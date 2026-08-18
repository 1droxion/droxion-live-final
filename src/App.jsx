import { Routes, Route, Navigate } from "react-router-dom";
import LiveFirstApp from "./LiveFirstApp.jsx";
import GlobalEnhancements from "./GlobalEnhancements.jsx";
import CreatorV11Enhancer from "./CreatorV11Enhancer.jsx";
import Login from "./Login.jsx";
import Signup from "./Signup.jsx";
import LegalPage from "./LegalPage.jsx";

export default function App() {
  return (
    <>
      <GlobalEnhancements />
      <CreatorV11Enhancer />
      <Routes>
        <Route path="/" element={<LiveFirstApp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/privacy" element={<LegalPage />} />
        <Route path="/terms" element={<LegalPage />} />
        <Route path="/community-guidelines" element={<LegalPage />} />
        <Route path="/support" element={<LegalPage />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/random" element={<Navigate to="/" replace />} />
        <Route path="/direct-call" element={<Navigate to="/" replace />} />
        <Route path="/profile-tools" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
