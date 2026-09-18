import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import LiveFirstApp from "./LiveFirstApp.jsx";
import GlobalEnhancements from "./GlobalEnhancements.jsx";
import CreatorV11Enhancer from "./CreatorV11Enhancer.jsx";
import LiveGuestStageGuard from "./LiveGuestStageGuard.jsx";
import ShortNativeActionsEnhancer from "./ShortNativeActionsEnhancer.jsx";
import ShortSafetyEnhancer from "./ShortSafetyEnhancer.jsx";
import DroxionPushNotifications from "./DroxionPushNotifications.jsx";
import DroxionLivePushBridge from "./DroxionLivePushBridge.jsx";
import Login from "./Login.jsx";
import Signup from "./Signup.jsx";
import ForgotPassword from "./ForgotPassword.jsx";
import ResetPassword from "./ResetPassword.jsx";
import LegalPage from "./LegalPage.jsx";
import DeleteAccount from "./DeleteAccount.jsx";
import CreatorAutopilotStudio from "./CreatorAutopilotStudio.jsx";
import LiveV2Page from "./pages/live/LiveV2Page.jsx";
import LiveV2ViewerPage from "./pages/live/LiveV2ViewerPage.jsx";

export default function App() {
  const location = useLocation();
  const isLiveV2 = location.pathname.startsWith('/live-v2');
  const isLegacyLive = location.pathname.startsWith('/live-social');
  const isCreatorStudio = location.pathname === '/' || ['/studio', '/dashboard', '/connect'].some(path => location.pathname.startsWith(path));
  const showLegacyEnhancers = isLegacyLive || (!isLiveV2 && !isCreatorStudio);

  return (
    <>
      {showLegacyEnhancers && <DroxionPushNotifications />}
      {showLegacyEnhancers && <DroxionLivePushBridge />}
      {showLegacyEnhancers && <GlobalEnhancements />}
      {showLegacyEnhancers && <CreatorV11Enhancer />}
      {showLegacyEnhancers && <LiveGuestStageGuard />}
      {showLegacyEnhancers && <ShortNativeActionsEnhancer />}
      {showLegacyEnhancers && <ShortSafetyEnhancer />}
      <Routes>
        <Route path="/" element={<CreatorAutopilotStudio initialTab="overview" />} />
        <Route path="/studio" element={<CreatorAutopilotStudio initialTab="overview" />} />
        <Route path="/live-social" element={<LiveFirstApp />} />
        <Route path="/dashboard" element={<CreatorAutopilotStudio initialTab="overview" />} />
        <Route path="/connect" element={<CreatorAutopilotStudio initialTab="channels" />} />
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
        <Route path="/random" element={<Navigate to="/" replace />} />
        <Route path="/direct-call" element={<Navigate to="/" replace />} />
        <Route path="/profile-tools" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
