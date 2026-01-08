'use client';

export default function SessionKeysTab() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-[#0A2540]">Session Keys</h1>
      <h2 className="mb-4 text-lg font-semibold text-[#0A2540]">Active Session Keys</h2>
      <p className="text-[#697386] my-4 mb-6">
        Session keys allow temporary delegated payment authority without exposing your main wallet.
      </p>
      
      <div className="bg-[#F6F9FC] p-8 rounded-xl text-center text-[#697386]">
        <svg
          width="48"
          height="48"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          className="mx-auto mb-3 opacity-50"
        >
          <path
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <p className="my-3 mx-0 font-medium">No active session keys</p>
        <p className="text-[13px] m-0">
          Session keys will appear here when created through the AI payment demo or API.
        </p>
      </div>
    </div>
  );
}
