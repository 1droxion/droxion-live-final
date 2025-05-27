import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();

    // Dummy auth logic
    if (email && password) {
      const user = {
        username: email.split("@")[0],
        email,
        credits: 10,
      };
      localStorage.setItem("droxion_user", JSON.stringify(user));
      navigate("/dashboard");
    } else {
      alert("Please enter valid credentials.");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-[#0b1120]">
      <div className="bg-[#111827] p-8 rounded shadow-lg w-full max-w-sm text-white border border-gray-700">
        <h2 className="text-xl font-bold text-center mb-6">🔐 Login</h2>

        <form onSubmit={handleLogin}>
          <label className="block mb-2 text-sm font-medium">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 mb-4 rounded bg-gray-800 text-white border border-gray-600 outline-none"
            required
          />

          <label className="block mb-2 text-sm font-medium">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 mb-6 rounded bg-gray-800 text-white border border-gray-600 outline-none"
            required
          />

          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-semibold"
          >
            Login
          </button>
        </form>

        <div className="text-sm mt-4 text-center">
          <Link to="/signup" className="text-blue-400 hover:underline">
            ➕ Create an account
          </Link>
        </div>

        <div className="text-xs mt-2 text-center text-gray-400">
          Forgot password?{" "}
          <a href="mailto:support@droxion.com" className="text-blue-400 hover:underline">
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}

export default Login;
