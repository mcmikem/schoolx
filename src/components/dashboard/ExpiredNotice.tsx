"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import MaterialIcon from "@/components/MaterialIcon";

export default function ExpiredNotice() {
  const { school, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleContactSupport = () => {
    window.location.href = `mailto:billing@omuto.sms?subject=Subscription Renewal: ${school?.name}`;
  };

  return (
    <div className="fixed inset-0 bg-[#f8fbff] flex flex-col items-center justify-center p-6 z-[9999]">
      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 max-w-md w-full border border-red-100/50 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 to-orange-400"></div>

        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <MaterialIcon style={{ fontSize: "32px" }}>lock_clock</MaterialIcon>
        </div>

        <h1 className="font-sora text-2xl font-bold text-[#10233b] mb-2">
          Trial Expired
        </h1>

        <p className="text-[#5c6670] mb-6 leading-relaxed">
          Your 30-day free trial for{" "}
          <strong>{school?.name || "your school"}</strong> has ended. To
          continue managing your students, academics, and finances, please
          upgrade your subscription.
        </p>

        <div className="bg-[#fcfdff] border border-[#e5e9f0] rounded-xl p-4 mb-8 text-left">
          <h3 className="text-sm font-semibold text-[#10233b] mb-3 uppercase tracking-wider">
            What happens next?
          </h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <MaterialIcon
                className="text-[#2e7d32] mt-0.5"
                style={{ fontSize: "18px" }}
              >
                shield
              </MaterialIcon>
              <span className="text-sm text-[#5c6670]">
                Your data is safe and securely backed up.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <MaterialIcon
                className="text-[#b45309] mt-0.5"
                style={{ fontSize: "18px" }}
              >
                block
              </MaterialIcon>
              <span className="text-sm text-[#5c6670]">
                Dashboard access is temporarily restricted.
              </span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleContactSupport}
            className="w-full bg-[#10233b] hover:bg-[#1a365d] active:scale-[0.98] transition-all text-white font-medium py-3.5 px-4 rounded-xl flex items-center justify-center gap-2"
          >
            <MaterialIcon style={{ fontSize: "20px" }}>
              credit_card
            </MaterialIcon>
            Upgrade Subscription
          </button>

          <button
            onClick={signOut}
            className="w-full bg-white hover:bg-gray-50 border border-[#e5e9f0] text-[#5c6670] font-medium py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <MaterialIcon style={{ fontSize: "20px" }}>logout</MaterialIcon>
            Sign Out
          </button>
        </div>

        {/* Omuto Foundation Ads */}
        <div className="mt-8 pt-6 border-t border-[#e5e9f0]">
          <p className="text-xs text-[#5c6670] mb-3">
            Brought to you by{" "}
            <a
              href="https://omuto.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-700 hover:text-amber-900 font-semibold"
            >
              Omuto Foundation
            </a>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <a
              href="https://omuto.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 p-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors group"
            >
              <MaterialIcon
                icon="volunteer_activism"
                className="text-amber-600 group-hover:text-amber-800"
                style={{ fontSize: 20 }}
              />
              <span className="text-xs font-medium text-amber-800">
                Omuto Foundation
              </span>
              <span className="text-[10px] text-amber-600">omuto.org</span>
            </a>
            <a
              href="https://essentials.omuto.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 p-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors group"
            >
              <MaterialIcon
                icon="star"
                className="text-blue-600 group-hover:text-blue-800"
                style={{ fontSize: 20 }}
              />
              <span className="text-xs font-medium text-blue-800">
                Omuto Essentials
              </span>
              <span className="text-[10px] text-blue-600">
                essentials.omuto.org
              </span>
            </a>
          </div>
          <a
            href="https://omuto.org/osx.php"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-sm transition-all active:scale-[0.98]"
          >
            <MaterialIcon icon="rocket_launch" style={{ fontSize: 18 }} />
            Join SkoolMate OS
          </a>
        </div>
      </div>
    </div>
  );
}
