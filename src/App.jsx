import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import LiveFirstApp from "./LiveFirstApp.jsx";
import GlobalEnhancements from "./GlobalEnhancements.jsx";
import CreatorV11Enhancer from "./CreatorV11Enhancer.jsx";
import LiveGuestStageGuard from "./LiveGuestStageGuard.jsx";
import ShortNativeActionsEnhancer from "./ShortNativeActionsEnhancer.jsx";
import DroxionPushNotifications from "./DroxionPushNotifications.jsx";
import DroxionLivePushBridge from "./DroxionLivePushBridge.jsx";
import Login from "./Login.jsx";
import Signup from "./Signup.jsx";
import ForgotPassword from "./ForgotPassword.jsx";
import ResetPassword from "./ResetPassword.jsx";
import LegalPage from "./LegalPage.jsx";
import DeleteAccount from "./DeleteAccount.jsx";
import LiveV2Page from "./pages/live/LiveV2Page.jsx";
import LiveV2ViewerPage from "./pages/live/LiveV2ViewerPage.jsx";

export default function App() {
  const location = useLocation();
  const isLiveV2 = location.pathname.startsWith('/live-v2');

  return (
    <>
      {!isLiveV2 && <DroxionPushNotifications />}
      {!isLiveV2 && <DroxionLivePushBridge />}
      {!isLiveV2 && <GlobalEnhancements />}
      {!isLiveV2 && <CreatorV11Enhancer />}
      {!isLiveV2 && <LiveGuestStageGuard />}
      {!isLiveV2 && <ShortNativeActionsEnhancer />}
      <Routes>
        <Route path="/" element={<LiveFirstApp />} />
        <Route path="/live-v2" element={<LiveV2Page />} />
        <Route path="/live-v2/view/:sessionId" element={<LiveV2ViewerPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<LegalPage />} />
        <Route path="/terms" element={<LegalPage />} />
        <Route path="/community-guidelines" element={<LegalPage />} />
        <Route path="/child-safety" element={<LegalPage />} />
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
