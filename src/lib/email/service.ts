import { createTransport, Transporter } from "nodemailer";
import { logger } from "@/lib/logger";
import { APP_NAME } from "@/lib/app-name";

const transporter: Transporter = createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: EmailOptions) {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"${APP_NAME}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""),
    });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error("Email send error:", error);
    return { success: false, error: String(error) };
  }
}

export async function sendWelcomeEmail(to: string, name: string, schoolName: string) {
  return sendEmail({
    to,
    subject: `Welcome to ${APP_NAME} - ${schoolName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0066CC;">Welcome to ${APP_NAME}!</h1>
        <p>Hi ${name},</p>
        <p>Your account has been created for <strong>${schoolName}</strong>.</p>
        <p>You can now log in to:</p>
        <ul>
          <li>View your child's attendance and grades</li>
          <li>Check fee balances and make payments</li>
          <li>Receive school notifications</li>
        </ul>
        <p>Login at: <a href="https://skoolmate.os/parent-portal">Parent Portal</a></p>
        <p>If you have any questions, contact the school directly.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Sent by ${APP_NAME} - School Management System</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetToken: string, schoolName: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;
  return sendEmail({
    to,
    subject: `Reset your password - ${schoolName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0066CC;">Reset Your Password</h1>
        <p>Hi,</p>
        <p>You requested to reset your password. Click the button below:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #0066CC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
            Reset Password
          </a>
        </p>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Sent by ${APP_NAME}</p>
      </div>
    `,
  });
}

export async function sendReceiptEmail(to: string, studentName: string, amount: number, schoolName: string, receiptNumber: string) {
  const formatted = new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(amount);
  return sendEmail({
    to,
    subject: `Payment Receipt - ${schoolName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0066CC;">Payment Receipt</h1>
        <p>Dear Parent,</p>
        <p>We received payment for <strong>${studentName}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">Receipt No.</td>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>${receiptNumber}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">Amount Paid</td>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>${formatted}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">Date</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${new Date().toLocaleDateString("en-UG")}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">School</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${schoolName}</td>
          </tr>
        </table>
        <p>Thank you for your payment!</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Sent by ${APP_NAME}</p>
      </div>
    `,
  });
}