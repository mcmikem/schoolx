"use client";
import { useRef } from "react";

interface ReceiptData {
  receipt_number: string;
  payment_date: string;
  student_name: string;
  student_number: string;
  class_name: string;
  amount_paid: number;
  payment_method: string;
  fee_name?: string;
  balance?: number;
  school_name: string;
  school_address?: string;
  school_phone?: string;
  received_by?: string;
}

interface ReceiptProps {
  data: ReceiptData;
  onClose?: () => void;
}

export default function Receipt({ data, onClose }: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = receiptRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const printContent = content.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <title>Receipt - ${data.receipt_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Courier New', monospace; 
            font-size: 14px; 
            padding: 20px;
            max-width: 300px;
            margin: 0 auto;
          }
          .header { text-align: center; margin-bottom: 20px; }
          .school-name { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
          .school-info { font-size: 11px; color: #666; }
          .divider { border-top: 1px dashed #000; margin: 15px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
          .label { color: #666; }
          .value { font-weight: bold; }
          .amount { font-size: 18px; font-weight: bold; text-align: center; margin: 15px 0; }
          .footer { text-align: center; font-size: 11px; color: #666; margin-top: 20px; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        ${printContent}
        <script>window.print(); window.close();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownload = () => {
    // Create a simple text receipt for download
    const text = `
${data.school_name.toUpperCase()}
${data.school_address || ""}
${data.school_phone || ""}

================================
         FEE PAYMENT RECEIPT
================================

Receipt No: ${data.receipt_number}
Date: ${data.payment_date}

--------------------------------
Student: ${data.student_name}
Number: ${data.student_number}
Class: ${data.class_name}
--------------------------------

${data.fee_name ? `Fee: ${data.fee_name}` : ""}
Amount Paid: UGX ${data.amount_paid.toLocaleString()}
Method: ${data.payment_method}
${data.balance !== undefined ? `Balance: UGX ${data.balance.toLocaleString()}` : ""}

--------------------------------
Received By: ${data.received_by || "________________"}

Thank you for your payment.
================================
    `.trim();

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt_${data.receipt_number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleWhatsAppShare = () => {
    const message = `*Fee Payment Receipt*
*${data.school_name}*

Receipt: ${data.receipt_number}
Date: ${data.payment_date}

Student: ${data.student_name}
Class: ${data.class_name}

Amount Paid: UGX ${data.amount_paid.toLocaleString()}
Payment Method: ${data.payment_method}
${data.balance !== undefined ? `Remaining Balance: UGX ${data.balance.toLocaleString()}` : ""}

Thank you for your payment.`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 12,
        overflow: "hidden",
        maxWidth: 400,
        margin: "0 auto",
      }}
    >
      {/* Receipt Content */}
      <div ref={receiptRef} style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--t1)",
              marginBottom: 4,
            }}
          >
            {data.school_name}
          </h2>
          {data.school_address && (
            <p style={{ fontSize: 12, color: "var(--t3)" }}>
              {data.school_address}
            </p>
          )}
          {data.school_phone && (
            <p style={{ fontSize: 12, color: "var(--t3)" }}>
              {data.school_phone}
            </p>
          )}
        </div>

        {/* Title */}
        <div
          style={{
            textAlign: "center",
            padding: "12px 0",
            borderTop: "2px dashed var(--border)",
            borderBottom: "2px dashed var(--border)",
            marginBottom: 24,
          }}
        >
          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--t1)",
              letterSpacing: 2,
            }}
          >
            FEE PAYMENT RECEIPT
          </p>
        </div>

        {/* Receipt Info */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span style={{ color: "var(--t3)", fontSize: 13 }}>
              Receipt No:
            </span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {data.receipt_number}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span style={{ color: "var(--t3)", fontSize: 13 }}>Date:</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {data.payment_date}
            </span>
          </div>
        </div>

        {/* Student Info */}
        <div
          style={{
            background: "var(--bg)",
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <span style={{ color: "var(--t3)", fontSize: 13 }}>Student:</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {data.student_name}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <span style={{ color: "var(--t3)", fontSize: 13 }}>Number:</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {data.student_number}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--t3)", fontSize: 13 }}>Class:</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {data.class_name}
            </span>
          </div>
        </div>

        {/* Payment Amount */}
        <div
          style={{
            textAlign: "center",
            padding: 20,
            background: "var(--green-soft)",
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 4 }}>
            Amount Paid
          </p>
          <p style={{ fontSize: 28, fontWeight: 700, color: "var(--green)" }}>
            UGX {data.amount_paid.toLocaleString()}
          </p>
        </div>

        {/* Payment Details */}
        <div style={{ marginBottom: 20 }}>
          {data.fee_name && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span style={{ color: "var(--t3)", fontSize: 13 }}>Fee:</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                {data.fee_name}
              </span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span style={{ color: "var(--t3)", fontSize: 13 }}>
              Payment Method:
            </span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {data.payment_method}
            </span>
          </div>
          {data.balance !== undefined && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--t3)", fontSize: 13 }}>Balance:</span>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: data.balance > 0 ? "var(--red)" : "var(--green)",
                }}
              >
                UGX {data.balance.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: "2px dashed var(--border)",
            paddingTop: 16,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 11, color: "var(--t3)" }}>
            Received By: {data.received_by || "________________"}
          </p>
          <p style={{ fontSize: 10, color: "var(--t4)", marginTop: 12 }}>
            Thank you for your payment
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: 16,
          borderTop: "1px solid var(--border)",
          background: "var(--bg)",
        }}
      >
        <button
          onClick={handlePrint}
          style={{
            flex: 1,
            padding: "10px 16px",
            background: "var(--navy)",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: 44,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            print
          </span>
          Print
        </button>
        <button
          onClick={handleWhatsAppShare}
          style={{
            flex: 1,
            padding: "10px 16px",
            background: "#25D366",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: 44,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            share
          </span>
          WhatsApp
        </button>
        <button
          onClick={handleDownload}
          style={{
            padding: "10px 12px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 44,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            download
          </span>
        </button>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: "10px 12px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 44,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 18 }}
            >
              close
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// Helper to generate receipt number
export function generateReceiptNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `RCP${year}${month}${day}${random}`;
}
