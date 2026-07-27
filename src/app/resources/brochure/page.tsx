import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  title: `Brochure — ${APP_NAME}`,
  description: "SkoolMate OS marketing brochure — the all-in-one school management system for Ugandan schools.",
};

export default function BrochurePage() {
  return (
    <div className="print-only">
      <style>{`
        @page { margin: 0; size: A4; }
        body { margin: 0; padding: 0; font-family: 'Helvetica', 'Arial', sans-serif; color: #1a1a2e; }
        .page { width: 210mm; min-height: 297mm; padding: 0; position: relative; page-break-after: always; }
        .page:last-child { page-break-after: avoid; }
        .cover { background: linear-gradient(135deg, #001f3f 0%, #003d7a 50%, #005ce6 100%); color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
        .cover h1 { font-size: 42pt; font-weight: 800; margin: 0 0 8pt; letter-spacing: -1pt; line-height: 1.1; }
        .cover .subtitle { font-size: 16pt; opacity: 0.85; margin: 0 0 40pt; font-weight: 300; }
        .cover .tagline { font-size: 11pt; opacity: 0.7; letter-spacing: 3pt; text-transform: uppercase; margin-bottom: 12pt; }
        .cover .badge { border: 1px solid rgba(255,255,255,0.3); border-radius: 100px; padding: 8pt 24pt; font-size: 10pt; letter-spacing: 2pt; text-transform: uppercase; }
        .section { padding: 40pt 48pt; }
        .section h2 { font-size: 22pt; color: #001f3f; margin: 0 0 16pt; font-weight: 700; }
        .section h3 { font-size: 14pt; color: #005ce6; margin: 20pt 0 8pt; font-weight: 600; }
        .section p { font-size: 10.5pt; line-height: 1.6; color: #333; margin: 0 0 10pt; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20pt; margin: 16pt 0; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16pt; margin: 16pt 0; }
        .card { border: 1px solid #e0e7ef; border-radius: 8pt; padding: 16pt; background: #f8faff; }
        .card h4 { font-size: 11pt; color: #001f3f; margin: 0 0 6pt; }
        .card p { font-size: 9pt; color: #555; line-height: 1.5; margin: 0; }
        .highlight { background: #e8f4ed; border-left: 4pt solid #2e9448; padding: 12pt 16pt; border-radius: 4pt; margin: 16pt 0; }
        .highlight p { margin: 0; font-size: 10pt; color: #1a5a30; }
        .pricing-table { width: 100%; border-collapse: collapse; margin: 16pt 0; font-size: 9.5pt; }
        .pricing-table th { background: #001f3f; color: white; padding: 10pt 12pt; text-align: left; font-weight: 600; }
        .pricing-table td { padding: 8pt 12pt; border-bottom: 1px solid #e0e7ef; }
        .pricing-table tr:nth-child(even) td { background: #f8faff; }
        .pricing-table .featured { background: #e8f4ed !important; font-weight: 600; }
        .footer-bar { position: absolute; bottom: 0; left: 0; right: 0; background: #001f3f; color: rgba(255,255,255,0.6); padding: 16pt 48pt; font-size: 8pt; text-align: center; }
        ul { margin: 6pt 0; padding-left: 18pt; }
        ul li { font-size: 10pt; line-height: 1.6; color: #333; margin-bottom: 3pt; }
        .center { text-align: center; }
        .cta-box { background: linear-gradient(135deg, #001f3f, #005ce6); color: white; border-radius: 12pt; padding: 28pt; text-align: center; margin: 20pt 0; }
        .cta-box h3 { color: white !important; font-size: 18pt !important; margin: 0 0 8pt !important; }
        .cta-box p { color: rgba(255,255,255,0.85) !important; font-size: 11pt; margin: 0 0 16pt !important; }
        .cta-box .contact { font-size: 10pt; color: rgba(255,255,255,0.9); }
        .cta-box .contact a { color: white; text-decoration: underline; }
      `}</style>

      {/* Page 1: Cover */}
      <div className="page cover">
        <div style={{ padding: "60pt 48pt" }}>
          <p className="tagline">Omuto Foundation</p>
          <h1>SkoolMate OS</h1>
          <p className="subtitle">The School Operating System for Ugandan Schools</p>
          <p style={{ fontSize: "11pt", opacity: 0.8, maxWidth: "360pt", margin: "0 auto 32pt", lineHeight: 1.5 }}>
            Attendance, grades, fees, and parent communication — all in one platform. Works online and offline.
          </p>
          <div style={{ display: "flex", gap: "12pt", justifyContent: "center", flexWrap: "wrap" }}>
            <span className="badge">30-day free trial</span>
            <span className="badge">No credit card required</span>
            <span className="badge">Made in Uganda</span>
          </div>
          <div style={{ marginTop: "60pt", fontSize: "9pt", opacity: 0.6 }}>
            <p>os@omuto.org &middot; 0750 028 703 &middot; omuto.org</p>
          </div>
        </div>
        <div className="footer-bar">
          SkoolMate OS by Omuto Foundation &middot; Marketing Brochure &middot; July 2026
        </div>
      </div>

      {/* Page 2: About + Problem */}
      <div className="page">
        <div className="section">
          <h2>Why SkoolMate OS?</h2>
          <p>
            Ugandan schools manage hundreds of students, staff, and parents every day. Yet most still rely on paper
            registers, separate spreadsheets for fees and grades, and manual SMS for parent communication. Teachers
            spend hours on administrative work that should take minutes. Head teachers make decisions without a clear
            view of what is happening in their school.
          </p>
          <p>
            SkoolMate OS was built to change that. It is a single platform that connects every part of school operations
            — attendance, academics, fees, communication, and reporting — so nothing falls through the cracks.
          </p>

          <div className="highlight">
            <p>
              <strong>Built from real experience:</strong> SkoolMate OS was developed by Omuto Foundation, based on
              years of direct work with Ugandan schools. It is designed for the way schools actually operate, not how
              software companies imagine they should.
            </p>
          </div>

          <h3>Who it is for</h3>
          <div className="grid-3">
            <div className="card">
              <h4>Head Teachers</h4>
              <p>
                See attendance, fees, and performance in one live dashboard. Make decisions with real data instead of
                guesswork.
              </p>
            </div>
            <div className="card">
              <h4>Teachers</h4>
              <p>
                Mark attendance in under 2 minutes. Enter grades once and generate report cards automatically. Works on
                any phone.
              </p>
            </div>
            <div className="card">
              <h4>Bursars & Finance</h4>
              <p>
                Track fee collection in real time. Accept MTN MoMo and Airtel Money payments. Generate receipts
                instantly.
              </p>
            </div>
          </div>
        </div>
        <div className="footer-bar">
          SkoolMate OS by Omuto Foundation &middot; Marketing Brochure &middot; July 2026
        </div>
      </div>

      {/* Page 3: Features */}
      <div className="page">
        <div className="section">
          <h2>Core Features</h2>

          <div className="grid-2">
            <div className="card">
              <h4>Student & Parent Records</h4>
              <p>
                Centralised profiles with attendance history, fee status, grades, and parent contact information. Import
                from CSV.
              </p>
            </div>
            <div className="card">
              <h4>Daily Attendance</h4>
              <p>
                Mark attendance on any device. Live dashboard for administrators. Automatic flags for low attendance.
                Works offline.
              </p>
            </div>
            <div className="card">
              <h4>Exams, Grades & Report Cards</h4>
              <p>
                CA and exam entry. Automated grade calculation. NCDC-compliant report cards. UNEB candidate
                registration.
              </p>
            </div>
            <div className="card">
              <h4>Fee Collection & Mobile Money</h4>
              <p>
                Fee structure management. MTN MoMo and Airtel Money integration. Automated receipts and invoices.
                Balance tracking.
              </p>
            </div>
            <div className="card">
              <h4>Bulk SMS & Parent Portal</h4>
              <p>
                Send fee reminders, attendance alerts, and event notifications via SMS. Parents can check results and
                fees online.
              </p>
            </div>
            <div className="card">
              <h4>NCDC Syllabus & Schemes</h4>
              <p>
                Aligned with the NCDC 2025 curriculum. Scheme of work planning. Lesson plans and homework assignments.
              </p>
            </div>
          </div>

          <h3>Additional Modules</h3>
          <div className="grid-3">
            <div className="card">
              <h4>Payroll</h4>
              <p>Full staff salary management with deductions, allowances, and payslips.</p>
            </div>
            <div className="card">
              <h4>ID Card Generation</h4>
              <p>Print student ID cards with photos and barcodes directly from the system.</p>
            </div>
            <div className="card">
              <h4>Library Management</h4>
              <p>Track book loans, returns, and inventory across your school library.</p>
            </div>
            <div className="card">
              <h4>Dorm & Transport</h4>
              <p>Boarding house attendance and transport route tracking for day scholars.</p>
            </div>
            <div className="card">
              <h4>DNA Analysis</h4>
              <p>AI-powered student performance trends and early warning flags for at-risk students.</p>
            </div>
            <div className="card">
              <h4>White Label</h4>
              <p>Custom branding with your school logo, colours, and domain name.</p>
            </div>
          </div>
        </div>
        <div className="footer-bar">
          SkoolMate OS by Omuto Foundation &middot; Marketing Brochure &middot; July 2026
        </div>
      </div>

      {/* Page 4: Pricing */}
      <div className="page">
        <div className="section">
          <h2>Pricing</h2>
          <p>Per-student pricing that scales with your school. No hidden fees. Start free for 30 days.</p>

          <table className="pricing-table">
            <thead>
              <tr>
                <th style={{ width: "22%" }}>Feature</th>
                <th style={{ width: "26%" }}>Starter</th>
                <th style={{ width: "26%" }} className="featured">
                  Growth
                </th>
                <th style={{ width: "26%" }}>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Price per student/term</strong>
                </td>
                <td>UGX 2,000</td>
                <td className="featured">UGX 3,500</td>
                <td>UGX 5,500</td>
              </tr>
              <tr>
                <td>Student records</td>
                <td>✓</td>
                <td className="featured">✓</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Daily attendance</td>
                <td>✓</td>
                <td className="featured">✓</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>CA entry & report cards</td>
                <td>✓</td>
                <td className="featured">✓</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Fee collection & tracking</td>
                <td>✓</td>
                <td className="featured">✓</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Mobile money (MTN/Airtel)</td>
                <td>✓</td>
                <td className="featured">✓</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Offline sync</td>
                <td>✓</td>
                <td className="featured">✓</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>ID card generation</td>
                <td>✓</td>
                <td className="featured">✓</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Admin users</td>
                <td>Up to 3</td>
                <td className="featured">Up to 10</td>
                <td>Unlimited</td>
              </tr>
              <tr>
                <td>Bulk SMS</td>
                <td>✗</td>
                <td className="featured">200/term included</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Parent portal</td>
                <td>✗</td>
                <td className="featured">✓</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>NCDC syllabus tools</td>
                <td>✗</td>
                <td className="featured">✓</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>UNEB registration</td>
                <td>✗</td>
                <td className="featured">✗</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Full payroll</td>
                <td>✗</td>
                <td className="featured">✗</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>AI insights & DNA analysis</td>
                <td>✗</td>
                <td className="featured">✗</td>
                <td>✓</td>
              </tr>
              <tr>
                <td style={{ border: "none" }}></td>
                <td style={{ border: "none" }}></td>
                <td className="featured" style={{ border: "none" }}></td>
                <td style={{ border: "none" }}></td>
              </tr>
            </tbody>
          </table>

          <p style={{ fontSize: "9pt", color: "#666", marginTop: "4pt" }}>
            Lifetime license available — one-time payment from UGX 8-15 million, includes full source code license and
            on-premise deployment.
          </p>

          <div className="highlight">
            <p>
              <strong>Parent Portal Module:</strong> Available as an add-on at UGX 200,000-700,000/year depending on
              school size.
            </p>
          </div>

          <h3>What marketers need to know</h3>
          <ul>
            <li>
              <strong>Free trial:</strong> 30 days, full access, no credit card required
            </li>
            <li>
              <strong>Setup:</strong> Schools are running in under 5 minutes. Full setup takes one afternoon.
            </li>
            <li>
              <strong>Support:</strong> Free onboarding via WhatsApp. In-person training available in Uganda.
            </li>
            <li>
              <strong>Offline:</strong> Teachers can mark attendance and enter grades without internet. Syncs
              automatically when connected.
            </li>
            <li>
              <strong>Data ownership:</strong> Schools own their data. Full export available anytime. Data deleted
              within 30 days of cancellation.
            </li>
          </ul>
        </div>
        <div className="footer-bar">
          SkoolMate OS by Omuto Foundation &middot; Marketing Brochure &middot; July 2026
        </div>
      </div>

      {/* Page 5: Contact */}
      <div className="page">
        <div
          className="section"
          style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "217mm" }}
        >
          <div className="cta-box">
            <h3>Ready to get started?</h3>
            <p>
              Start your free 30-day trial today. No credit card required.
              <br />
              Or book a personalised demo with our team.
            </p>
            <div className="contact">
              <p>
                <strong>Email:</strong> <a href="mailto:os@omuto.org">os@omuto.org</a>
              </p>
              <p>
                <strong>Phone:</strong> <a href="tel:0750028703">0750 028 703</a>
              </p>
              <p>
                <strong>WhatsApp:</strong> <a href="https://wa.me/256750028703">+256 750 028 703</a>
              </p>
              <p>
                <strong>Web:</strong> <a href="https://omuto.org">omuto.org</a>
              </p>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: "24pt" }}>
            <div className="card" style={{ textAlign: "center" }}>
              <h4 style={{ fontSize: "13pt" }}>Start Free Trial</h4>
              <p>Register your school at omuto.org/register and start using SkoolMate OS immediately.</p>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <h4 style={{ fontSize: "13pt" }}>Book a Demo</h4>
              <p>
                Schedule a free walkthrough at omuto.org/demo. We will show you the platform tailored to your school.
              </p>
            </div>
          </div>

          <div
            style={{
              marginTop: "32pt",
              padding: "16pt",
              background: "#f0f4f8",
              borderRadius: "8pt",
              fontSize: "9pt",
              color: "#555",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4pt" }}>
              <strong>Omuto Foundation</strong> &middot; Kampala, Uganda
            </p>
            <p style={{ margin: "0" }}>
              SkoolMate OS is a product of Omuto Foundation, a Ugandan organisation dedicated to improving school
              operations through technology.
            </p>
          </div>
        </div>
        <div className="footer-bar">
          SkoolMate OS by Omuto Foundation &middot; Marketing Brochure &middot; July 2026 &middot; v1.0
        </div>
      </div>
    </div>
  );
}
