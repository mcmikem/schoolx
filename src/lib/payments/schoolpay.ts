// SchoolPay Integration Service
// For syncing fee payments from SchoolPay platform
// Docs: https://schoolpay.co.ug/paymentapi

import crypto from "crypto";

const SCHOOLPAY_BASE_URL = "https://schoolpay.co.ug/paymentapi";

interface SchoolPayConfig {
  schoolCode: string;
  apiPassword: string;
}

interface SchoolPayTransaction {
  amount: string;
  paymentDateAndTime: string;
  schoolpayReceiptNumber: string;
  settlementBankCode: string;
  sourceChannelTransDetail: string;
  sourceChannelTransactionId: string;
  sourcePaymentChannel: string;
  studentName: string;
  studentPaymentCode: string;
  studentRegistrationNumber: string;
  transactionCompletionStatus: string;
}

interface SchoolPaySupplementaryPayment {
  amount: string;
  paymentDateAndTime: string;
  schoolpayReceiptNumber: string;
  settlementBankCode: string;
  sourceChannelTransDetail: string;
  sourceChannelTransactionId: string;
  sourcePaymentChannel: string;
  studentClass: string;
  studentName: string;
  studentPaymentCode: string;
  studentRegistrationNumber: string;
  supplementaryFeeDescription: string;
  supplementaryFeeId: string;
  transactionCompletionDateAndTime: string;
  transactionCompletionStatus: string;
}

interface SchoolPaySyncResponse {
  returnCode: number;
  returnMessage: string;
  transactions: SchoolPayTransaction[];
  supplementaryFeePayments: SchoolPaySupplementaryPayment[];
}

export class SchoolPayService {
  private config: SchoolPayConfig;

  constructor(schoolCode: string, apiPassword: string) {
    if (!schoolCode || !apiPassword) {
      throw new Error("SchoolPay school code and API password are required");
    }
    this.config = { schoolCode, apiPassword };
  }

  private generateHash(date: string): string {
    const hashInput = this.config.schoolCode + date + this.config.apiPassword;
    return crypto
      .createHash("md5")
      .update(hashInput)
      .digest("hex")
      .toUpperCase();
  }

  async syncTransactionsByDate(date: string): Promise<SchoolPaySyncResponse> {
    const hash = this.generateHash(date);
    const url = `${SCHOOLPAY_BASE_URL}/AndroidRS/SyncSchoolTransactions/${this.config.schoolCode}/${date}/${hash}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`SchoolPay API error: ${response.status}`);
      }
      const data = (await response.json()) as SchoolPaySyncResponse;
      return data;
    } catch (error) {
      console.error("SchoolPay sync error:", error);
      throw error;
    }
  }

  async syncTransactionsByRange(
    fromDate: string,
    toDate: string,
  ): Promise<SchoolPaySyncResponse> {
    const hash = this.generateHash(fromDate);
    const url = `${SCHOOLPAY_BASE_URL}/AndroidRS/SchoolRangeTransactions/${this.config.schoolCode}/${fromDate}/${toDate}/${hash}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`SchoolPay API error: ${response.status}`);
      }
      const data = (await response.json()) as SchoolPaySyncResponse;
      return data;
    } catch (error) {
      console.error("SchoolPay sync error:", error);
      throw error;
    }
  }

  parseRegularTransactions(response: SchoolPaySyncResponse) {
    return response.transactions
      .filter((t) => t.transactionCompletionStatus === "Completed")
      .map((t) => ({
        amount: parseFloat(t.amount),
        paymentDate: new Date(t.paymentDateAndTime),
        receiptNumber: t.schoolpayReceiptNumber,
        bank: t.settlementBankCode,
        channel: t.sourcePaymentChannel,
        studentName: t.studentName,
        studentPaymentCode: t.studentPaymentCode,
        transactionId: t.sourceChannelTransactionId,
      }));
  }

  parseSupplementaryPayments(response: SchoolPaySyncResponse) {
    return response.supplementaryFeePayments
      .filter((p) => p.transactionCompletionStatus === "Completed")
      .map((p) => ({
        amount: parseFloat(p.amount),
        paymentDate: new Date(p.paymentDateAndTime),
        receiptNumber: p.schoolpayReceiptNumber,
        bank: p.settlementBankCode,
        channel: p.sourcePaymentChannel,
        studentName: p.studentName,
        studentPaymentCode: p.studentPaymentCode,
        studentClass: p.studentClass,
        feeDescription: p.supplementaryFeeDescription,
        feeId: p.supplementaryFeeId,
        transactionId: p.sourceChannelTransactionId,
      }));
  }
}

export function createSchoolPayService(
  schoolCode: string,
  apiPassword: string,
) {
  return new SchoolPayService(schoolCode, apiPassword);
}
