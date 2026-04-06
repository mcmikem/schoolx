"use client";
import { useState, useEffect } from "react";
import MaterialIcon from "@/components/MaterialIcon";

const WHATSAPP_NUMBER = "25670028703";
const WHATSAPP_MESSAGE = "Hi, I need help with SkulMate OS.";

export default function WhatsAppSupport() {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50">
      {/* Chat window */}
      {show && (
        <div
          className="absolute bottom-16 right-0 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
          style={{ animation: "slideUp 0.2s ease-out" }}
        >
          {/* Header */}
          <div className="bg-[#25D366] px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <MaterialIcon className="text-white text-base">
                support_agent
              </MaterialIcon>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm">
                SkulMate OS Support
              </div>
              <div className="text-white/80 text-xs">
                Your Digital School Partner
              </div>
            </div>
            <button
              onClick={() => setShow(false)}
              className="text-white/80 hover:text-white p-1 flex-shrink-0"
            >
              <MaterialIcon className="text-lg">close</MaterialIcon>
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {/* Bot message */}
            <div className="bg-gray-100 rounded-xl rounded-tl-sm p-3 text-sm text-gray-800 leading-relaxed">
              Hi! How can we help you today?
            </div>

            {/* Quick actions */}
            <div className="space-y-2">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-[#25D366] text-white rounded-xl font-medium text-sm hover:bg-[#20BD5A] active:scale-[0.98] transition-all"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.195.194 1.382.121.273-.109.87-.415 1.04-.82.173-.405.173-.75.124-.85-.049-.148-.297-.348-.446-.521-.149-.174-.298-.298-.446-.298-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.195.194 1.382.121.273-.109.87-.415 1.04-.82.173-.405.173-.75.124-.85-.049-.148-.297-.348-.446-.521-.149-.174-.298-.298-.446-.298-.198 0-.52.074-.792.372z" />
                  <path
                    d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0"
                  />
                </svg>
                Chat on WhatsApp
              </a>
              <a
                href="mailto:support@omuto.org?subject=SkulMate OS Support Request"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 active:scale-[0.98] transition-all"
              >
                <MaterialIcon className="text-base">email</MaterialIcon>
                Email Support
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setShow(!show)}
        className="w-14 h-14 bg-[#25D366] rounded-full shadow-lg flex items-center justify-center hover:bg-[#20BD5A] active:scale-95 transition-all"
        aria-label="Get support"
      >
        {show ? (
          <MaterialIcon className="text-white text-xl">close</MaterialIcon>
        ) : (
          <svg
            className="w-7 h-7 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.195.194 1.382.121.273-.109.87-.415 1.04-.82.173-.405.173-.75.124-.85-.049-.148-.297-.348-.446-.521-.149-.174-.298-.298-.446-.298-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.195.194 1.382.121.273-.109.87-.415 1.04-.82.173-.405.173-.75.124-.85-.049-.148-.297-.348-.446-.521-.149-.174-.298-.298-.446-.298-.198 0-.52.074-.792.372z" />
          </svg>
        )}
      </button>
    </div>
  );
}
