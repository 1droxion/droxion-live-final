import { Routes, Route, Navigate } from "react-router-dom";
import DroxionNew from "./DroxionNew.jsx";
import Login from "./Login.jsx";
import Signup from "./Signup.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DroxionNew />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Old dashboard is removed */}
      <Route path="/dashboard" element={<Navigate to="/" replace />} />

      {/* Any old/unknown route goes to new Droxion */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
