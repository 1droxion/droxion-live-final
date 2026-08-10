import { Routes, Route, Navigate } from "react-router-dom";
import DroxionNew from "./DroxionNew.jsx";
import RandomCall from "./RandomCall.jsx";
import Login from "./Login.jsx";
import Signup from "./Signup.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DroxionNew />} />
      <Route path="/random" element={<RandomCall />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
