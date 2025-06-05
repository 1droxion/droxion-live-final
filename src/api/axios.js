// src/api/axios.js
import axios from "axios";

const instance = axios.create({
  baseURL: "https://droxion-backend.onrender.com", // ✅ Replace with your backend URL if different
  withCredentials: true,
});

export default instance;
