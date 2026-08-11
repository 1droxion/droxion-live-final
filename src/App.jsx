import { Routes, Route, Navigate } from "react-router-dom";
import DroxionHomeReal from "./DroxionHomeReal.jsx";
import RandomCall from "./RandomCall.jsx";
import DirectCall from "./DirectCall.jsx";
import ProfileTools from "./ProfileTools.jsx";
import GlobalEnhancements from "./GlobalEnhancements.jsx";
import Login from "./Login.jsx";
import Signup from "./Signup.jsx";

export default function App() {
  return (
    <>
      <GlobalEnhancements />
      <Routes>
        <Route path="/" element={<DroxionHomeReal />} />
        <Route path="/random" element={<RandomCall />} />
        <Route path="/direct-call" element={<DirectCall />} />
        <Route path="/profile-tools" element={<ProfileTools />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
