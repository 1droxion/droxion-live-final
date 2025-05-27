import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function SearchBar() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.toLowerCase();

    if (q.includes("generate") || q.includes("reel")) navigate("/generator");
    else if (q.includes("dashboard")) navigate("/dashboard");
    else if (q.includes("chat")) navigate("/chatboard");
    else if (q.includes("setting")) navigate("/settings");
    else if (q.includes("plans") || q.includes("credit")) navigate("/plans");
    else if (q.includes("profile")) navigate("/profile");
    else if (q.includes("project")) navigate("/projects");
    else if (q.includes("image")) navigate("/ai-image");
    else alert("No matching page.");
  };

  return (
    <form onSubmit={handleSearch} className="flex items-center bg-gray-800 rounded-full px-3 py-1">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        className="bg-transparent text-white placeholder-gray-400 focus:outline-none w-full"
      />
      <button type="submit" className="text-white font-bold ml-2">🔍</button>
    </form>
  );
}

export default SearchBar;
