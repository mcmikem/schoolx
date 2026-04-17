import { NextRequest, NextResponse } from "next/server";
import { requireDevelopmentRouteOrDeny } from "@/lib/api-utils";

// Demo credentials - ONLY accessible server-side
const DEMO_CREDS = {
  "0700000001": {
    role: "headmaster",
    name: "John Headmaster",
    school_id: "demo-school",
  },
  "0700000002": {
    role: "teacher",
    name: "Mary Teacher",
    school_id: "demo-school",
  },
  "0700000003": {
    role: "bursar",
    name: "James Bursar",
    school_id: "demo-school",
  },
  "0700000004": {
    role: "dean_of_studies",
    name: "Sarah Dean",
    school_id: "demo-school",
  },
  "0700000005": {
    role: "parent",
    name: "Robert Parent",
    school_id: "demo-school",
  },
};

const DEMO_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || "skoolmate_demo_2024";

const DEMO_SCHOOL = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "St. Mary's Primary School (Demo)",
  school_code: "DEMO001",
  district: "Kampala",
  school_type: "primary",
  ownership: "private",
  primary_color: "#17325F",
  subscription_plan: "growth",
  subscription_status: "active",
};

export async function POST(request: NextRequest) {
  try {
    const devOnly = requireDevelopmentRouteOrDeny();
    if (!devOnly.ok) return devOnly.response;

    const { phone, password } = await request.json();

    if (!phone || !password) {
      return NextResponse.json(
        { error: "Phone and password required" },
        { status: 400 },
      );
    }

    const cleanPhone = phone.replace(/[^0-9]/g, "");

    // Validate demo login server-side
    if (
      password === DEMO_PASSWORD &&
      DEMO_CREDS[cleanPhone as keyof typeof DEMO_CREDS]
    ) {
      return NextResponse.json({
        success: true,
        demo: true,
        user: DEMO_CREDS[cleanPhone as keyof typeof DEMO_CREDS],
        school: DEMO_SCHOOL,
      });
    }

    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
