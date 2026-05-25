// File: src/components/RefundRequestModal.tsx
import { useState, useCallback } from 'react';
import { PaymentModeSelect } from './PaymentModeSelect';
import { type PaymentMode } from '@/types/payment';

type RefundRequest = {
  studentId: string;
  amount: number;
  reason?: string;
  paymentMode: PaymentMode;
};

/**
 * A modal dialog that lets a Bursar create a refund request.
 * Uses the `/api/refund` endpoint defined in `src/app/api/refund/route.ts`.
 */
export const RefundRequestModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [request, setRequest] = useState<RefundRequest>({
    studentId: '',
    amount: 0,
    paymentMode: 'cash',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setRequest((prev) => ({
        ...prev,
        [name]: name === 'amount' ? Number(value) : value,
      }));
    },
    []
  );

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to create refund');
      }
      // Success – close modal and optionally refresh UI
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-lg max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl bg-white bg-opacity-90 p-6 shadow-xl backdrop-filter backdrop-blur-lg my-auto">
        <button
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
          onClick={onClose}
          aria-label="Close modal"
        >
          ✕
        </button>
        <h2 className="mb-4 text-xl font-semibold text-gray-800">Create Refund Request</h2>
        {error && (
          <div className="mb-3 rounded bg-red-100 p-2 text-sm text-red-800">
            {error}
          </div>
        )}
        <div className="grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Student ID</span>
            <input
              type="text"
              name="studentId"
              value={request.studentId}
              onChange={handleChange}
              className="mt-1 block w-full rounded border border-gray-300 bg-white p-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-300"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Amount</span>
            <input
              type="number"
              name="amount"
              value={request.amount}
              onChange={handleChange}
              min="0"
              step="0.01"
              className="mt-1 block w-full rounded border border-gray-300 bg-white p-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-300"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Reason (optional)</span>
            <input
              type="text"
              name="reason"
              value={request.reason ?? ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded border border-gray-300 bg-white p-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-300"
            />
          </label>
          <div>
            <span className="text-sm font-medium text-gray-700">Payment Mode</span>
            <PaymentModeSelect
              value={request.paymentMode}
              onChange={(mode) => setRequest((prev) => ({ ...prev, paymentMode: mode }))}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
};
