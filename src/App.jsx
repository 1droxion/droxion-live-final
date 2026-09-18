import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import LiveFirstApp from "./LiveFirstApp.jsx";
import DroxionPushNotifications from "./DroxionPushNotifications.jsx";
import DroxionLivePushBridge from "./DroxionLivePushBridge.jsx";
import Login from "./Login.jsx";
import Signup from "./Signup.jsx";
import ForgotPassword from "./ForgotPassword.jsx";
import ResetPassword from "./ResetPassword.jsx";
import OAuthCallback from "./features/auth/OAuthCallback.jsx";
import NativeOAuthBridge from "./features/auth/NativeOAuthBridge.jsx";
import LegalPage from "./LegalPage.jsx";
import DeleteAccount from "./DeleteAccount.jsx";
import NativeLivePlayer from "./NativeLivePlayer.jsx";

export default function App() {
  const location = useLocation();
  const isNativeLivePlayer = location.pathname === "/native-live-player";

  return (
    <>
      {!isNativeLivePlayer && <NativeOAuthBridge />}
      {!isNativeLivePlayer && <DroxionPushNotifications />}
      {!isNativeLivePlayer && <DroxionLivePushBridge />}
      <Routes>
        <Route path="/" element={<LiveFirstApp />} />
        <Route path="/native-live-player" element={<NativeLivePlayer />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<OAuthCallback />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<LegalPage />} />
        <Route path="/terms" element={<LegalPage />} />
        <Route path="/community-guidelines" element={<LegalPage />} />
        <Route path="/child-safety" element={<LegalPage />} />
        <Route path="/support" element={<LegalPage />} />
        <Route path="/delete-account" element={<DeleteAccount />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
