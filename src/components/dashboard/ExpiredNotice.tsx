"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import MaterialIcon from "@/components/MaterialIcon";

export default function ExpiredNotice() {
  const { school, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleContactSupport = () => {
    window.location.href = `mailto:billing@omuto.org?subject=Subscription Renewal: ${school?.name}`;
  };

  return (
    <div className="fixed inset-0 bg-[#f8fbff] flex flex-col items-center justify-center p-4 z-[9999] overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-6 sm:p-8 max-w-md w-full border border-red-100/50 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 to-orange-400"></div>

        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-red-100 to-orange-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <MaterialIcon style={{ fontSize: "28px" }}>lock_clock</MaterialIcon>
        </div>

        <h1 className="font-sora text-xl sm:text-2xl font-bold text-slate-800 mb-2">
          Trial Expired
        </h1>

        <p className="text-slate-600 mb-6 leading-relaxed text-sm">
          Your free trial for <strong>{school?.name || "your school"}</strong>{" "}
          has ended. Upgrade now to continue managing students, academics &
          finances!
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-left">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <MaterialIcon className="text-amber-600" style={{ fontSize: 18 }}>
              lightbulb
            </MaterialIcon>
            What happens next?
          </h3>
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <MaterialIcon
                className="text-green-600 mt-0.5"
                style={{ fontSize: 16 }}
              >
                check_circle
              </MaterialIcon>
              <span className="text-xs text-slate-600">
                Your data is safe & backed up.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <MaterialIcon
                className="text-amber-600 mt-0.5"
                style={{ fontSize: 16 }}
              >
                schedule
              </MaterialIcon>
              <span className="text-xs text-slate-600">
                Dashboard access is temporarily restricted.
              </span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <a
            href="/dashboard/payment-plans"
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-[0.98] transition-all text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30"
          >
            <MaterialIcon style={{ fontSize: 20 }}>rocket_launch</MaterialIcon>
            Upgrade Now - Starting €9/mo
          </a>

          <button
            onClick={signOut}
            className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all text-sm"
          >
            <MaterialIcon style={{ fontSize: 18 }}>logout</MaterialIcon>
            Sign Out
          </button>
        </div>

        {/* Omuto Foundation Ads - More conversion focused */}
        <div className="mt-6 pt-5 border-t border-slate-200">
          <p className="text-xs text-slate-500 mb-3">
            Powered by{" "}
            <a
              href="https://omuto.org/osx.php"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 font-bold hover:underline"
            >
              Omuto Foundation
            </a>
            : Empowering Schools through OSX
          </p>
          <div className="grid grid-cols-1 gap-2">
            <a
              href="https://omuto.org/osx.php"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <MaterialIcon className="text-white" style={{ fontSize: 18 }}>
                  school
                </MaterialIcon>
              </div>
              <div className="text-left flex-1">
                <span className="text-xs font-bold text-amber-800 block">
                  Omuto School Xperience
                </span>
                <span className="text-[10px] text-amber-600">
                  Full school transformation
                </span>
              </div>
              <MaterialIcon className="text-amber-500" style={{ fontSize: 18 }}>
                arrow_forward
              </MaterialIcon>
            </a>
            <a
              href="https://essentials.omuto.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl border border-green-200 bg-green-50 hover:bg-green-100 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
                <MaterialIcon className="text-white" style={{ fontSize: 18 }}>
                  shopping_bag
                </MaterialIcon>
              </div>
              <div className="text-left flex-1">
                <span className="text-xs font-bold text-green-800 block">
                  Omuto Essentials
                </span>
                <span className="text-[10px] text-green-600">
                  Shop supplies & tools
                </span>
              </div>
              <MaterialIcon className="text-green-600" style={{ fontSize: 18 }}>
                arrow_forward
              </MaterialIcon>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
