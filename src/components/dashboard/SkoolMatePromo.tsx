"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import MaterialIcon from "@/components/MaterialIcon";

const OMUTO_SERVICES = [
  {
    title: "Omuto School Xperience (OSX)",
    description:
      "Full school transformation with advanced features, custom branding & dedicated support. Transform how you manage!",
    url: "https://omuto.org/osx.php",
    icon: "rocket_launch",
    color: "#17325F",
    bgColor: "rgba(23,50,95,0.08)",
    cta: "Get Started",
    highlight: true,
  },
  {
    title: "Omuto Essentials",
    description:
      "Affordable tools for small schools. Start with what you need - attendance, grades, fees & SMS.",
    url: "https://essentials.omuto.org",
    icon: "shopping_bag",
    color: "#2E9448",
    bgColor: "rgba(46,148,72,0.08)",
    cta: "Shop Now",
  },
  {
    title: "Omuto Foundation",
    description:
      "Youth programs, leadership training & community engagement. Empowering students beyond the classroom.",
    url: "https://omuto.org/foundation",
    icon: "groups",
    color: "#0d9488",
    bgColor: "rgba(13,148,136,0.08)",
    cta: "Learn More",
  },
];

export default function SkoolMatePromo() {
  const { school, isTrialExpired } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("skoolmate_promo_dismissed");
    if (saved) setDismissed(true);
  }, []);

  if (!mounted || dismissed) return null;

  // Only show for trial or expired accounts
  const isTrial = school?.subscription_status === "trial" || isTrialExpired;
  if (!isTrial) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("skoolmate_promo_dismissed", "true");
  };

  return (
    <div className="mx-2 sm:mx-4 mt-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <MaterialIcon
                icon="workspace_premium"
                className="text-white text-sm"
                style={{ fontSize: 18 }}
              />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider font-bold text-amber-600">
                Limited Time Offer
              </div>
              <div className="text-[15px] font-bold text-slate-800">
                Upgrade Your School Today
              </div>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <MaterialIcon icon="close" style={{ fontSize: 18 }} />
          </button>
        </div>

        {/* Service Cards */}
        <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {OMUTO_SERVICES.map((service) => (
            <a
              key={service.title}
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`group rounded-xl border p-4 hover:shadow-lg transition-all ${
                service.highlight
                  ? "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 hover:border-amber-400"
                  : "border-[var(--border)] hover:border-slate-400"
              }`}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ backgroundColor: service.bgColor }}
              >
                <MaterialIcon
                  icon={service.icon}
                  className="text-xl"
                  style={{ color: service.color }}
                />
              </div>
              <div className="font-bold text-sm text-slate-800 mb-1 group-hover:text-slate-900 transition-colors">
                {service.title}
              </div>
              <div className="text-xs text-slate-500 leading-relaxed mb-3">
                {service.description}
              </div>
              <div
                className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg ${
                  service.highlight
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30"
                    : "bg-slate-100 text-slate-700 group-hover:bg-slate-200"
                }`}
                style={service.highlight ? {} : { color: service.color }}
              >
                <MaterialIcon icon="arrow_forward" style={{ fontSize: 14 }} />
                {service.cta}
              </div>
            </a>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="px-4 pb-4 text-center">
          <p className="text-xs text-slate-500">
            Powered by{" "}
            <a
              href="https://omuto.org/osx.php"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-amber-600 hover:underline"
            >
              Omuto Foundation
            </a>
            : Empowering Ugandan Schools through Technology
          </p>
        </div>
      </div>
    </div>
  );
}
