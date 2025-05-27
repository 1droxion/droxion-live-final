// src/utils/userUtils.js

export function getCredits() {
  const user = JSON.parse(localStorage.getItem("droxion_user"));
  return user?.credits || 0;
}

export function deductCredit() {
  const user = JSON.parse(localStorage.getItem("droxion_user")) || {};
  user.credits = Math.max(0, (user.credits || 0) - 1);
  localStorage.setItem("droxion_user", JSON.stringify(user));
}
