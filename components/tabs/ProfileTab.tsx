'use client';

import { useMerchant } from '@/lib/merchant-context';
import DangerZone from '@/components/DangerZone';

interface ProfileTabProps {
  onSwitchTab: (tab: string) => void;
}

export default function ProfileTab({ onSwitchTab }: ProfileTabProps) {
  const { merchant, isLoading } = useMerchant();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner spinner-dark" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-[#0A2540]">Profile & Settings</h1>

      {/* Account Overview */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-[#0A2540]">Account Information</h2>

        <div className="grid gap-5">
          <div className="bg-[#F6F9FC] p-5 rounded-xl">
            <strong className="block mb-2 text-[#697386] text-xs uppercase tracking-[0.5px]">
              Business Name
            </strong>
            <p className="text-[#1A1F36] m-0 text-base font-semibold">{merchant?.name}</p>
          </div>

          <div className="bg-[#F6F9FC] p-5 rounded-xl">
            <strong className="block mb-2 text-[#697386] text-xs uppercase tracking-[0.5px]">
              Email Address
            </strong>
            <p className="text-[#1A1F36] m-0 text-base">{merchant?.email}</p>
          </div>

          <div className="bg-[#F6F9FC] p-5 rounded-xl">
            <strong className="block mb-2 text-[#697386] text-xs uppercase tracking-[0.5px]">
              Account ID
            </strong>
            <p className="text-[#1A1F36] m-0 font-mono text-sm">{merchant?.id}</p>
          </div>

          <div className="bg-[#F6F9FC] p-5 rounded-xl">
            <strong className="block mb-2 text-[#697386] text-xs uppercase tracking-[0.5px]">
              Member Since
            </strong>
            <p className="text-[#1A1F36] m-0 text-base">
              {merchant?.created_at
                ? new Date(merchant.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Wallet Information */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-[#0A2540]">Wallet Configuration</h2>

        <div className="bg-[#F6F9FC] p-5 rounded-xl">
          <strong className="block mb-3 text-[#697386] text-xs uppercase tracking-[0.5px]">
            Settlement Wallet Address
          </strong>
          <div className="bg-[#FAFBFC] p-3 px-3.5 rounded-md border border-[#E3E8EE] font-mono text-xs break-all text-[#0A2540] mb-2">
            {merchant?.wallet_address}
          </div>
          <p className="text-[#697386] text-[13px] m-0">
            All payments are automatically settled to this wallet address.
          </p>
        </div>
      </div>

      {/* Security & Access */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-[#0A2540]">Security & Access</h2>

        <div className="grid gap-4">
          <div className="bg-[#F6F9FC] p-5 rounded-xl flex justify-between items-center">
            <div>
              <strong className="block mb-1 text-[#1A1F36]">API Keys</strong>
              <p className="text-[#697386] m-0 text-[13px]">
                Manage your API keys for integration
              </p>
            </div>
            <button
              onClick={() => onSwitchTab('api-keys')}
              className="px-4 py-2 bg-white border border-[#E3E8EE] rounded-md text-[#5B6EE8] font-medium cursor-pointer hover:bg-[#FAFBFC]"
            >
              View Keys
            </button>
          </div>

          <div className="bg-[#F6F9FC] p-5 rounded-xl flex justify-between items-center">
            <div>
              <strong className="block mb-1 text-[#1A1F36]">Session Keys</strong>
              <p className="text-[#697386] m-0 text-[13px]">
                Temporary payment authorization keys
              </p>
            </div>
            <button
              onClick={() => onSwitchTab('session-keys')}
              className="px-4 py-2 bg-white border border-[#E3E8EE] rounded-md text-[#5B6EE8] font-medium cursor-pointer hover:bg-[#FAFBFC]"
            >
              View Keys
            </button>
          </div>

          <div className="bg-[#F6F9FC] p-5 rounded-xl flex justify-between items-center">
            <div>
              <strong className="block mb-1 text-[#1A1F36]">Webhooks</strong>
              <p className="text-[#697386] m-0 text-[13px]">
                Configure real-time event notifications
              </p>
            </div>
            <button
              onClick={() => onSwitchTab('webhooks')}
              className="px-4 py-2 bg-white border border-[#E3E8EE] rounded-md text-[#5B6EE8] font-medium cursor-pointer hover:bg-[#FAFBFC]"
            >
              Configure
            </button>
          </div>
        </div>
      </div>

      {/* Wallet Security */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-[#0A2540]">Wallet Security</h2>
        <DangerZone />
      </div>

      {/* Resources */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-[#0A2540]">Resources</h2>

        <div className="grid gap-4">
          <a
            href="https://zendfi.tech/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#F6F9FC] p-5 rounded-xl flex justify-between items-center no-underline text-inherit hover:bg-[#EEF2FF]"
          >
            <div>
              <strong className="block mb-1 text-[#1A1F36]">Documentation</strong>
              <p className="text-[#697386] m-0 text-[13px]">
                API reference, guides, and tutorials
              </p>
            </div>
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="#5B6EE8"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>

          <a
            href="https://github.com/zendfi"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#F6F9FC] p-5 rounded-xl flex justify-between items-center no-underline text-inherit hover:bg-[#EEF2FF]"
          >
            <div>
              <strong className="block mb-1 text-[#1A1F36]">GitHub</strong>
              <p className="text-[#697386] m-0 text-[13px]">Open source code and examples</p>
            </div>
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="#5B6EE8"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
