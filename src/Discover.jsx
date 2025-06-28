// src/Discover.jsx
import React, { useEffect, useState } from "react";
import fakeUsers from "./fakeUsers";

function Discover({ gender, country }) {
  const [displayUsers, setDisplayUsers] = useState([]);

  useEffect(() => {
    const filtered = fakeUsers.filter(u => {
      const genderMatch = gender === "any" || u.gender === gender;
      const countryMatch = country === "any" || u.country === country;
      return genderMatch && countryMatch;
    });

    setDisplayUsers(filtered);
  }, [gender, country]);

  return (
    <div style={{ textAlign: "center" }}>
      <h1 style={{ color: "#ffcc70", marginBottom: 20 }}>🟢 Online Users</h1>

      <div style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "20px"
      }}>
        {displayUsers.map((user, i) => (
          <div key={i} style={{
            background: "#1a1a1a",
            borderRadius: "16px",
            padding: "12px",
            width: "160px",
            textAlign: "center",
            boxShadow: "0 0 10px rgba(0,0,0,0.5)"
          }}>
            <img src={user.photo} alt={user.name} style={{ width: "100%", borderRadius: "12px" }} />
            <h3 style={{ margin: "10px 0 4px", fontSize: "1rem", color: "#fff" }}>{user.name}</h3>
            <p style={{ color: "#bbb", fontSize: "0.9rem" }}>{user.country.toUpperCase()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Discover;
