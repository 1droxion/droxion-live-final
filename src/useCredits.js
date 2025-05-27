// utils/useCredits.js

const KEY = "droxion_user";

export const getCredits = () => {
  const user = JSON.parse(localStorage.getItem(KEY)) || {};
  return user.credits || 0;
};

export const deductCredit = () => {
  const user = JSON.parse(localStorage.getItem(KEY)) || {};
  if (user.credits && user.credits > 0) {
    user.credits -= 1;
    localStorage.setItem(KEY, JSON.stringify(user));
  }
};

export const addCredits = (amount) => {
  const user = JSON.parse(localStorage.getItem(KEY)) || {};
  user.credits = (user.credits || 0) + amount;
  localStorage.setItem(KEY, JSON.stringify(user));
};

export const setCredits = (amount) => {
  const user = JSON.parse(localStorage.getItem(KEY)) || {};
  user.credits = amount;
  localStorage.setItem(KEY, JSON.stringify(user));
};
