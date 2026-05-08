"use client";
import { useRef } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui";

interface StatementTransaction {
  date: string;
  description: string;
  reference?: string;
  debit?: number;
  credit?: number;
  balance: number;
}

interface StatementProps {
  student: {
    name: string;
    number: string;
    class_name: string;
    opening_balance: number;
  };
  transactions: StatementTransaction[];
  school: {
    name: string;
    address?: string;
    phone?: string;
    logo?: string;
  };
  onClose?: () => void;
}

export default function StudentStatement({ student, transactions, school, onClose }: StatementProps) {
  const statementRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = statementRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Statement - ${student.name}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .school-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .school-info { font-size: 14px; color: #666; }
            .statement-title { font-size: 18px; font-weight: bold; margin: 20px 0; text-align: center; background: #f8f9fa; padding: 10px; border-radius: 8px; }
            .info-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .info-item { font-size: 14px; }
            .info-label { color: #666; font-weight: 500; }
            .info-value { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { text-align: left; background: #f8f9fa; padding: 12px 8px; font-size: 13px; border-bottom: 2px solid #eee; }
            td { padding: 10px 8px; font-size: 13px; border-bottom: 1px solid #eee; }
            .text-right { text-align: right; }
            .footer { margin-top: 50px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
            .summary-box { float: right; width: 250px; background: #f8f9fa; padding: 15px; border-radius: 8px; }
            .summary-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
            .total-row { font-weight: bold; border-top: 1px solid #ddd; margin-top: 10px; padding-top: 10px; font-size: 16px; }
          </style>
        </head>
        <body>
          ${content.innerHTML}
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const currentBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : student.opening_balance;

  return (
    <div className="bg-[var(--surface)] rounded-2xl overflow-hidden shadow-xl max-w-4xl mx-auto border border-[var(--border)]">
      <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-surface-container">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <MaterialIcon icon="account_balance_wallet" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Student Statement</h2>
            <p className="text-xs text-on-surface-variant">Financial ledger for {student.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handlePrint}>
            <MaterialIcon icon="print" className="mr-2" />
            Print PDF
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <MaterialIcon icon="close" />
            </Button>
          )}
        </div>
      </div>

      <div ref={statementRef} className="p-8 bg-white text-black">
        <div className="header text-center mb-8 pb-6 border-b-2 border-gray-100">
          <h1 className="text-2xl font-bold uppercase tracking-tight">{school.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{school.address}</p>
          <p className="text-sm text-gray-500">{school.phone}</p>
        </div>

        <div className="statement-title text-center py-3 bg-gray-50 rounded-lg font-bold text-lg mb-8">
          STUDENT FINANCIAL STATEMENT
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="space-y-2">
            <div className="text-sm">
              <span className="text-gray-500 font-medium w-32 inline-block">Student Name:</span>
              <span className="font-bold">{student.name}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500 font-medium w-32 inline-block">Student No:</span>
              <span className="font-bold">{student.number}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500 font-medium w-32 inline-block">Class:</span>
              <span className="font-bold">{student.class_name}</span>
            </div>
          </div>
          <div className="space-y-2 text-right">
            <div className="text-sm">
              <span className="text-gray-500 font-medium mr-2">Statement Date:</span>
              <span className="font-bold">{new Date().toLocaleDateString()}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500 font-medium mr-2">Academic Year:</span>
              <span className="font-bold">2024/2025</span>
            </div>
          </div>
        </div>

        <table className="w-full border-collapse mb-8">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-100">
              <th className="p-3 text-left text-xs font-bold uppercase">Date</th>
              <th className="p-3 text-left text-xs font-bold uppercase">Description / Reference</th>
              <th className="p-3 text-right text-xs font-bold uppercase">Debit (+)</th>
              <th className="p-3 text-right text-xs font-bold uppercase">Credit (-)</th>
              <th className="p-3 text-right text-xs font-bold uppercase">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 italic">
              <td className="p-3 text-sm">--</td>
              <td className="p-3 text-sm font-medium">Opening Balance</td>
              <td className="p-3 text-sm text-right">--</td>
              <td className="p-3 text-sm text-right">--</td>
              <td className="p-3 text-sm text-right font-bold">{student.opening_balance.toLocaleString()}</td>
            </tr>
            {transactions.map((tx, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="p-3 text-sm">{tx.date}</td>
                <td className="p-3 text-sm">
                  <div className="font-medium">{tx.description}</div>
                  {tx.reference && <div className="text-[10px] text-gray-400 font-mono">{tx.reference}</div>}
                </td>
                <td className="p-3 text-sm text-right text-red-600">
                  {tx.debit ? `+${tx.debit.toLocaleString()}` : '--'}
                </td>
                <td className="p-3 text-sm text-right text-green-600">
                  {tx.credit ? `-${tx.credit.toLocaleString()}` : '--'}
                </td>
                <td className="p-3 text-sm text-right font-bold">
                  {tx.balance.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Opening:</span>
              <span className="font-medium">{student.opening_balance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mb-2 text-red-600">
              <span>Total Fees (+):</span>
              <span className="font-medium">
                {transactions.reduce((sum, t) => sum + (t.debit || 0), 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm mb-4 text-green-600">
              <span>Total Paid (-):</span>
              <span className="font-medium">
                {transactions.reduce((sum, t) => sum + (t.credit || 0), 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
              <span className="font-bold text-gray-700">Closing Balance:</span>
              <span className={`text-lg font-black ${currentBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                UGX {currentBalance.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="footer mt-12 text-center text-[10px] text-gray-400 border-t pt-6">
          <p>This is a computer-generated document. No signature required.</p>
          <p className="mt-1 font-mono">{school.name} Management System • Statement ID: ST-{Date.now().toString().slice(-6)}</p>
        </div>
      </div>
    </div>
  );
}
