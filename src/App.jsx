import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import DroxionNew from "./DroxionNew.jsx";
import RandomCall from "./RandomCall.jsx";
import Login from "./Login.jsx";
import Signup from "./Signup.jsx";

function DroxionHome() {
  const navigate = useNavigate();

  return (
    <>
      <DroxionNew />
      <button
        onClick={() => navigate('/random')}
        aria-label="Start real random video call"
        style={{
          position: 'fixed',
          right: 18,
          bottom: 86,
          zIndex: 999,
          border: 0,
          borderRadius: 999,
          padding: '14px 18px',
          background: '#7c3aed',
          color: '#fff',
          fontWeight: 900,
          boxShadow: '0 10px 30px rgba(0,0,0,.35)'
        }}
      >
        Random Call
      </button>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DroxionHome />} />
      <Route path="/random" element={<RandomCall />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
