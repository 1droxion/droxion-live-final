import React from "react";

export default function NewCampaign() {
  return (
    <div className="min-h-screen bg-[#0e0e10] text-white flex items-center justify-center">
      <div className="max-w-3xl w-full p-10 rounded-2xl border border-gray-800 bg-[#17181c]">
        <h1 className="text-4xl font-bold mb-4">
          🚀 Droxion Campaign Generator
        </h1>

        <p className="text-gray-400 mb-8">
          Upload a product and generate a complete DTC marketing campaign.
        </p>

        <button className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl text-lg font-semibold">
          Generate Campaign
        </button>
      </div>
    </div>
  );
}
