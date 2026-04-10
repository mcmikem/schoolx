import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { createSupabaseServerClient } from "../supabase/server";

export interface ReceiptData {
  schoolName: string;
  schoolCode: string;
  schoolEmail?: string;
  schoolPhone?: string;
  schoolLogo?: string;
  amount: number;
  currency: string;
  plan: string;
  provider: string;
  transactionId: string;
  paymentDate: string;
  receiptNumber: string;
}

export async function generateReceiptPDF(data: ReceiptData): Promise<Buffer> {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT RECEIPT", 105, 25, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("SkoolMate OS", 105, 32, { align: "center" });
  doc.text("www.omuto.org | os@omuto.org", 105, 37, { align: "center" });

  doc.setLineWidth(0.5);
  doc.line(20, 42, 190, 42);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("School Information", 20, 52);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`School Name: ${data.schoolName}`, 20, 60);
  doc.text(`School Code: ${data.schoolCode}`, 20, 66);
  if (data.schoolEmail) {
    doc.text(`Email: ${data.schoolEmail}`, 20, 72);
  }
  if (data.schoolPhone) {
    doc.text(`Phone: ${data.schoolPhone}`, 20, 78);
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Details", 120, 52);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Receipt #: ${data.receiptNumber}`, 120, 60);
  doc.text(`Date: ${data.paymentDate}`, 120, 66);
  doc.text(`Transaction ID: ${data.transactionId}`, 120, 72);
  doc.text(`Payment Method: ${data.provider.toUpperCase()}`, 120, 78);

  doc.line(20, 85, 190, 85);

  const tableData = [
    ["Plan", data.plan.charAt(0).toUpperCase() + data.plan.slice(1)],
    ["Amount", `${data.currency} ${data.amount.toLocaleString()}`],
    ["Total", `${data.currency} ${data.amount.toLocaleString()}`],
  ];

  (doc as jsPDF & { autoTable: (options: unknown) => void }).autoTable({
    startY: 92,
    head: [["Description", "Value"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [0, 32, 69],
      textColor: [255, 255, 255],
    },
    columnStyles: {
      0: { fontStyle: "bold" },
    },
  });

  const finalY =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 15;

  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.text("Thank you for your payment!", 105, finalY, { align: "center" });
  doc.text("Your subscription is now active.", 105, finalY + 6, {
    align: "center",
  });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    "This is an electronically generated receipt. No signature required.",
    105,
    finalY + 20,
    { align: "center" },
  );

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  return pdfBuffer;
}

export async function sendEmailReceipt(
  schoolId: string,
  receiptData: ReceiptData,
): Promise<{ success: boolean; message: string }> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.log("Resend API key not configured, skipping email receipt");
      return { success: false, message: "Email service not configured" };
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #002045; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .receipt-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .row:last-child { border-bottom: none; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Receipt</h1>
            <p>SkoolMate OS</p>
          </div>
          <div class="content">
            <p>Dear ${receiptData.schoolName},</p>
            <p>Thank you for your payment! This is your official receipt.</p>
            
            <div class="receipt-box">
              <div class="row">
                <span>Receipt Number:</span>
                <span>${receiptData.receiptNumber}</span>
              </div>
              <div class="row">
                <span>Transaction ID:</span>
                <span>${receiptData.transactionId}</span>
              </div>
              <div class="row">
                <span>Date:</span>
                <span>${receiptData.paymentDate}</span>
              </div>
              <div class="row">
                <span>Plan:</span>
                <span>${receiptData.plan.charAt(0).toUpperCase() + receiptData.plan.slice(1)}</span>
              </div>
              <div class="row">
                <span>Payment Method:</span>
                <span>${receiptData.provider.toUpperCase()}</span>
              </div>
              <div class="row">
                <span>Amount:</span>
                <span>${receiptData.currency} ${receiptData.amount.toLocaleString()}</span>
              </div>
            </div>
            
            <p>Your subscription is now active and you can access all features of your plan.</p>
          </div>
          <div class="footer">
            <p>SkoolMate OS</p>
            <p>www.omuto.org | os@omuto.org</p>
            <p>This is an electronically generated receipt.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "SkoolMate OS <pay@omuto.org>",
        to: receiptData.schoolEmail || "os@omuto.org",
        subject: `Payment Receipt - ${receiptData.schoolName}`,
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", error);
      return { success: false, message: "Failed to send email" };
    }

    return { success: true, message: "Receipt sent successfully" };
  } catch (error) {
    console.error("Email receipt error:", error);
    return { success: false, message: "Failed to send email receipt" };
  }
}

export async function sendSMSReceipt(
  schoolId: string,
  receiptData: ReceiptData,
): Promise<{ success: boolean; message: string }> {
  try {
    const smsApiKey = process.env.AFRICAS_TALKING_API_KEY;
    const smsUsername = process.env.AFRICAS_TALKING_USERNAME;

    if (!smsApiKey || !smsUsername) {
      console.log("SMS not configured, skipping SMS receipt");
      return { success: false, message: "SMS service not configured" };
    }

    const supabase = await createSupabaseServerClient();
    const { data: school } = await supabase
      .from("schools")
      .select("phone")
      .eq("id", schoolId)
      .single();

    if (!school?.phone) {
      return { success: false, message: "School phone number not found" };
    }

    const message = `SKOOLMATE: Payment of UGX ${receiptData.amount.toLocaleString()} for ${receiptData.plan.toUpperCase()} plan received. Receipt: ${receiptData.receiptNumber}. Thank you!`;

    const response = await fetch(
      `https://api.africastalking.com/version1/messaging`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          apiKey: smsApiKey,
        },
        body: new URLSearchParams({
          username: smsUsername,
          to: school.phone,
          message: message,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Africa's Talking API error:", error);
      return { success: false, message: "Failed to send SMS" };
    }

    return { success: true, message: "SMS receipt sent successfully" };
  } catch (error) {
    console.error("SMS receipt error:", error);
    return { success: false, message: "Failed to send SMS receipt" };
  }
}

export async function generateReceiptNumber(): Promise<string> {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `OMR-${timestamp}-${random}`;
}

const receiptsApi = {
  generateReceiptPDF,
  sendEmailReceipt,
  sendSMSReceipt,
  generateReceiptNumber,
};

export default receiptsApi;
