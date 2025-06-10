import React from "react";

function Success() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black to-purple-900 text-white flex flex-col items-center justify-center">
      <h1 className="text-5xl font-bold mb-4">✅ Payment Successful!</h1>
      <p className="text-xl text-green-400">Your plan is now active and coins have been added.</p>
    </div>
  );
}

export default Success;
