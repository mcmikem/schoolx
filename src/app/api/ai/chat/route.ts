import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY || "",
});

const SYSTEM_PROMPT = `You are Owly, the helpful assistant for SkoolMate (also called Omuto School Management System). 
You help teachers, headteachers, bursars, and parents in Ugandan schools.

Keep responses short, practical, and in plain English. Use **bold** for emphasis.
If asked about specific student/school data, explain how to find it in the app instead of making up data.
If you don't know something, say so honestly.

School Management features available: Students, Staff, Classes, Attendance, Grades, Fees,
Report Cards, Timetable, Syllabus (NCDC curriculum), SMS, Notices, Library, Health, Discipline,
Transport, Dormitory, Payroll, Budget/Expenses, UNEB Registration, Parent Portal.

The app is designed for the Ugandan education system (NCDC curriculum, UNEB exams, MTN/Airtel payments).
If the user asks about fees/payments that aren't processing, suggest they contact support.
`;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message } = await request.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (!process.env.GOOGLE_GENAI_API_KEY) {
      return NextResponse.json({
        response:
          "I can't connect to my AI brain right now — the API key isn't configured.\n\nHere's what I can tell you: Ask about **fees, attendance, grades, NCDC curriculum, timetable, SMS, students, staff, reports, UNEB, discipline, health, library, or setup**.\n\nOr click the WhatsApp button to talk directly to the team.",
      });
    }

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        { role: "model", parts: [{ text: "Understood. I'll help SkoolMate users with their questions." }] },
        { role: "user", parts: [{ text: message }] },
      ],
    });

    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return NextResponse.json({ response: "Sorry, I couldn't generate a response. Please try again." });
    }

    return NextResponse.json({ response: text });
  } catch (error) {
    logger.error("[AI Chat] Error:", error);
    return NextResponse.json({
      response:
        "I hit a technical glitch. Please try again in a moment, or use the WhatsApp button below to reach the team directly.",
    });
  }
}
