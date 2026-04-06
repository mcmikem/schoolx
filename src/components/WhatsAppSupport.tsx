"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const WHATSAPP_NUMBER = "25670028703";
const WHATSAPP_MESSAGE = "Hi, I need help with SkoolMate OS.";

export default function WhatsAppSupport() {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Don't show in login/register pages
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/parent"
  ) {
    return null;
  }

  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 group"
      aria-label="Contact support on WhatsApp"
    >
      <div className="w-14 h-14 bg-[#25D366] rounded-full shadow-lg flex items-center justify-center hover:bg-[#20BD5A] active:scale-95 transition-all">
        <svg
          className="w-7 h-7 text-white"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.195.194 1.382.121.273-.109.87-.415 1.04-.82.173-.405.173-.75.124-.85-.049-.148-.297-.348-.446-.521-.149-.174-.298-.298-.446-.298-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.195.194 1.382.121.273-.109.87-.415 1.04-.82.173-.405.173-.75.124-.85-.049-.148-.297-.348-.446-.521-.149-.174-.298-.298-.446-.298-.198 0-.52.074-.792.372z" />
        </svg>
      </div>
      <span className="absolute right-16 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
        Get Help
      </span>
    </a>
  );
}
