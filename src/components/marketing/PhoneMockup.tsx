"use client";
import { useState, useEffect, useRef } from "react";
import { smsMessages } from "./landing-data";
import { APP_NAME } from "@/lib/app-name";

export function PhoneMockup() {
  const [activeMsg, setActiveMsg] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [mounted, setMounted] = useState(false);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const msg = smsMessages[activeMsg].text;
    setTypedText("");
    let i = 0;
    typingRef.current = setInterval(() => {
      if (i <= msg.length) {
        setTypedText(msg.slice(0, i));
        i++;
      } else {
        if (typingRef.current) clearInterval(typingRef.current);
        nextRef.current = setTimeout(
          () => setActiveMsg((prev) => (prev + 1) % smsMessages.length),
          3000,
        );
      }
    }, 25);
    return () => {
      if (typingRef.current) clearInterval(typingRef.current);
      if (nextRef.current) clearTimeout(nextRef.current);
    };
  }, [activeMsg]);

  return (
    <div
      className={`mx-auto transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      style={{
        width: 258,
        position: "relative",
        filter: "drop-shadow(0 40px 80px rgba(0,0,0,0.52))",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -3,
          top: "14%",
          width: 3,
          height: 22,
          borderRadius: "4px 0 0 4px",
          background: "linear-gradient(180deg,#56565a,#323234)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -3,
          top: "24%",
          width: 3,
          height: 36,
          borderRadius: "4px 0 0 4px",
          background: "linear-gradient(180deg,#56565a,#323234)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -3,
          top: "34%",
          width: 3,
          height: 36,
          borderRadius: "4px 0 0 4px",
          background: "linear-gradient(180deg,#56565a,#323234)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -3,
          top: "26%",
          width: 3,
          height: 48,
          borderRadius: "0 4px 4px 0",
          background: "linear-gradient(180deg,#56565a,#323234)",
        }}
      />

      <div
        style={{
          background:
            "linear-gradient(160deg, #424244 0%, #1d1d1f 50%, #111113 100%)",
          borderRadius: 52,
          padding: 4,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.14), 0 0 0 1px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            background: "#000",
            borderRadius: 48,
            overflow: "hidden",
            height: 530,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              height: 50,
              position: "relative",
              background: "#17325F",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 10,
                left: "50%",
                transform: "translateX(-50%)",
                width: 88,
                height: 24,
                background: "#000",
                borderRadius: 20,
                zIndex: 10,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 6,
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "space-between",
                padding: "0 16px",
                fontSize: 10,
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              <span>9:41</span>
              <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <span style={{ letterSpacing: 1 }}>▲▲▲</span>
                <span>WiFi</span>
                <span>▮</span>
              </span>
            </div>
          </div>

          <div
            style={{
              flexShrink: 0,
              background: "#17325F",
              padding: "8px 16px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  color: "rgba(255,255,255,0.6)",
                  marginBottom: 2,
                }}
              >
                {`${APP_NAME} parent portal`}
              </p>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                Fee &amp; attendance update
              </p>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: 20,
                padding: "4px 10px",
                fontSize: 10,
                color: "#fff",
              }}
            >
              SMS
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflow: "hidden",
              background: "#f6f9fc",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: "12px 14px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                border: "1px solid #e8eef4",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}
                >
                  {smsMessages[activeMsg].from}
                </span>
                <span style={{ fontSize: 9, color: "#94a3b8" }}>
                  {activeMsg === 0 ? "Incoming" : "Outgoing"}
                </span>
              </div>
              <div style={{ height: 68, overflow: "hidden" }}>
                <p
                  style={{ fontSize: 12, lineHeight: "1.55", color: "#475569" }}
                >
                  {typedText}
                  <span
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: 14,
                      background: "#17325F",
                      marginLeft: 2,
                      verticalAlign: "middle",
                      animation: "pulse 1s infinite",
                    }}
                  />
                </p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {[
                ["Recipients", "426"],
                ["Characters", "147/160"],
              ].map(([label, val]) => (
                <div
                  key={label}
                  style={{
                    background: "#fff",
                    borderRadius: 14,
                    padding: "10px 12px",
                    border: "1px solid #e8eef4",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: "0.15em",
                      color: "#94a3b8",
                      marginBottom: 6,
                    }}
                  >
                    {label}
                  </p>
                  <p
                    style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}
                  >
                    {val}
                  </p>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 6,
                marginTop: 2,
              }}
            >
              {smsMessages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveMsg(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveMsg(i);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`View message ${i + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#17325F] ${
                    i === activeMsg ? "w-6 bg-[#17325F]" : "w-2 bg-slate-300"
                  }`}
                />
              ))}
            </div>
          </div>

          <div
            style={{
              flexShrink: 0,
              height: 24,
              background: "#000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 96,
                height: 4,
                background: "rgba(255,255,255,0.28)",
                borderRadius: 4,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
