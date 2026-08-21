import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY || "",
});

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_TURNS = 12;

interface ChatContext {
  role?: string;
  schoolName?: string;
  page?: string;
}

function buildSystemPrompt(ctx: ChatContext): string {
  const facts = [
    ctx.role ? `The user's app role is ${ctx.role}.` : "",
    ctx.schoolName ? `The user's school is ${ctx.schoolName}.` : "",
    ctx.page ? `The user is currently on the ${ctx.page} page.` : "",
  ].filter(Boolean);

  return `You are Owly, the in-app assistant for SkoolMate OS, a school management system built for Ugandan schools.
You help teachers, headteachers, bursars, and admin staff. Answer in plain, practical English. Keep answers short (under ~120 words), use **bold** for key steps, and give step-by-step navigation.

${facts.length ? `Context about this user: ${facts.join(" ")}` : ""}

Rules:
- Never invent specific data (student names, fee balances, grades, staff). Teach the user how to find it in the app instead.
- Be honest. If you don't know, say so and suggest tapping the WhatsApp support button shown in the chat.
- Attendance, grades, and fee entries can be recorded OFFLINE and sync automatically when back online — mention this when relevant.
- If the user seems stuck or asks "where do I start", point them to the Setup Wizard, the guided tour, and the one-tap WhatsApp onboarding call with the team.
- The app targets both small local and growing Ugandan schools; keep advice simple and practical.

Feature map (only describe these): Students & enrollment (incl. CSV import), Classes, Staff & payroll, Attendance (class/staff/dorm, offline-capable), Grades & report cards (NCDC-aligned), Fees & payments (cash, MTN MoMo, Airtel), Timetable, Syllabus (NCDC topics), Messages/SMS/notices, Library, Health log, Discipline/behavior, Transport, Budget/expenses, UNEB registration (PLE/UCE/UACE), Parent portal, Reports (MoES/UNEB/term-end), Automation.`;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, history, context } = await request.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (!process.env.GOOGLE_GENAI_API_KEY) {
      return NextResponse.json({
        response:
          "I can't connect to my AI brain right now — the API key isn't configured.\n\nHere's what I can tell you: Ask about **fees, attendance, grades, NCDC curriculum, timetable, SMS, students, staff, reports, UNEB, discipline, health, library, or setup**.\n\nOr use the WhatsApp button to talk directly to our team.",
      });
    }

    const rawContext = (context && typeof context === "object" ? context : {}) as ChatContext;
    const ctx: ChatContext = {
      role: typeof rawContext.role === "string" ? rawContext.role.slice(0, 40) : undefined,
      page: typeof rawContext.page === "string" ? rawContext.page.slice(0, 120) : undefined,
    };
    try {
      const schoolId =
        (user.user_metadata?.school_id as string | undefined) ||
        (user.user_metadata?.active_school_id as string | undefined);
      if (schoolId) {
        const { data: schoolRow } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();
        ctx.schoolName = schoolRow?.name as string | undefined;
      }
    } catch {
      // School lookup is best-effort; proceed without it.
    }

    const text = message.slice(0, MAX_MESSAGE_LENGTH);

    const historyTurns: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    if (Array.isArray(history)) {
      for (const turn of history.slice(-MAX_HISTORY_TURNS)) {
        const role = turn?.role;
        const body = typeof turn?.text === "string" ? turn.text.slice(0, MAX_MESSAGE_LENGTH) : "";
        if (!body) continue;
        if (role === "user" || role === "assistant") {
          historyTurns.push({ role: role === "user" ? "user" : "model", parts: [{ text: body }] });
        }
      }
    }

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: buildSystemPrompt(ctx) }] },
        { role: "model", parts: [{ text: "Understood. I'll help with practical, honest answers." }] },
        ...historyTurns,
        { role: "user", parts: [{ text }] },
      ],
      config: {
        maxOutputTokens: 500,
        temperature: 0.4,
      },
    });

    const generated = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generated) {
      return NextResponse.json({ response: "Sorry, I couldn't generate a response. Please try again." });
    }

    return NextResponse.json({ response: generated.slice(0, 4000) });
  } catch (error) {
    logger.error("[AI Chat] Error:", error);
    return NextResponse.json({
      response:
        "I hit a technical glitch. Please try again in a moment, or use the WhatsApp button below to reach the team directly.",
    });
  }
}
