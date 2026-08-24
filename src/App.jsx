import { Routes, Route, Navigate } from "react-router-dom";
import LiveFirstApp from "./LiveFirstApp.jsx";
import GlobalEnhancements from "./GlobalEnhancements.jsx";
import CreatorV11Enhancer from "./CreatorV11Enhancer.jsx";
import LiveJoinDeclineEnhancer from "./LiveJoinDeclineEnhancer.jsx";
import DroxionPushNotifications from "./DroxionPushNotifications.jsx";
import DroxionLivePushBridge from "./DroxionLivePushBridge.jsx";
import Login from "./Login.jsx";
import Signup from "./Signup.jsx";
import ForgotPassword from "./ForgotPassword.jsx";
import ResetPassword from "./ResetPassword.jsx";
import LegalPage from "./LegalPage.jsx";
import DeleteAccount from "./DeleteAccount.jsx";

export default function App() {
  return (
    <>
      <DroxionPushNotifications />
      <DroxionLivePushBridge />
      <GlobalEnhancements />
      <CreatorV11Enhancer />
      <LiveJoinDeclineEnhancer />
      <Routes>
        <Route path="/" element={<LiveFirstApp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<LegalPage />} />
        <Route path="/terms" element={<LegalPage />} />
        <Route path="/community-guidelines" element={<LegalPage />} />
        <Route path="/support" element={<LegalPage />} />
        <Route path="/delete-account" element={<DeleteAccount />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/random" element={<Navigate to="/" replace />} />
        <Route path="/direct-call" element={<Navigate to="/" replace />} />
        <Route path="/profile-tools" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
