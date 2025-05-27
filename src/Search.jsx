import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

function SearchBar() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  // Load search history
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem("droxion_search_history")) || [];
    setSuggestions(history);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.toLowerCase().trim();
    if (!q) return;

    // Save to local history
    const newHistory = [q, ...suggestions.filter((item) => item !== q)].slice(0, 5);
    localStorage.setItem("droxion_search_history", JSON.stringify(newHistory));
    setSuggestions(newHistory);
    setShowDropdown(false);

    // Routing logic
    if (q.includes("generate") || q.includes("reel")) {
      navigate("/generator");
    } else if (q.includes("dashboard") || q.includes("credit")) {
      navigate("/dashboard");
    } else if (q.includes("chat") || q.includes("assistant")) {
      navigate("/chatboard");
    } else if (q.includes("image") || q.includes("photo") || q.includes("style")) {
      navigate("/ai-image");
    } else if (q.includes("template")) {
      navigate("/templates");
    } else if (q.includes("plan") || q.includes("limit")) {
      navigate("/plans");
    } else if (q.includes("setting") || q.includes("sound") || q.includes("toast")) {
      navigate("/settings");
    } else if (q.includes("profile")) {
      navigate("/profile");
    } else if (q.includes("connect")) {
      navigate("/connect");
    } else if (q.includes("project")) {
      navigate("/projects");
    } else if (q.includes("editor")) {
      navigate("/editor");
    } else {
      alert("🔍 No match found.");
    }
  };

  const handleSuggestionClick = (value) => {
    setQuery(value);
    setShowDropdown(false);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search Droxion..."
          className={`w-full px-4 py-2 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:outline-none transition duration-300 ${
            query
              ? "ring-2 ring-green-500 shadow-md"
              : "focus:ring-2 focus:ring-green-500"
          }`}
        />
      </form>

      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-[#1f2937] border border-gray-600 rounded-md shadow-lg">
          {suggestions.map((item, idx) => (
            <li
              key={idx}
              className="px-4 py-2 text-sm text-white hover:bg-gray-700 cursor-pointer"
              onClick={() => handleSuggestionClick(item)}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SearchBar;
