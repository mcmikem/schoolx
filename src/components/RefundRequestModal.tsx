// File: src/components/RefundRequestModal.tsx
import { useState, useCallback } from 'react';
import { PaymentModeSelect } from './PaymentModeSelect';
import { type PaymentMode } from '@/types/payment';
import { useToast } from '@/components/Toast';

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
  students = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  students?: Array<{ id: string; first_name: string; last_name: string; student_number: string }>;
}) => {
  const toast = useToast();
  const [request, setRequest] = useState<RefundRequest>({
    studentId: '',
    amount: 0,
    paymentMode: 'cash',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState<Array<{ id: string; first_name: string; last_name: string; student_number: string }>>([]);
  const [selectedStudentName, setSelectedStudentName] = useState('');

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
      toast.success("Refund request submitted successfully");
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
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Student</label>
            <input
              type="text"
              placeholder="Search by name or admission number..."
              className="mt-1 block w-full rounded border border-gray-300 bg-white p-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-300"
              value={studentSearch}
              onChange={(e) => {
                const val = e.target.value;
                setStudentSearch(val);
                if (val.length > 1) {
                  const results = (students || []).filter(
                    (s) =>
                      `${s.first_name} ${s.last_name}`.toLowerCase().includes(val.toLowerCase()) ||
                      (s.student_number || '').toLowerCase().includes(val.toLowerCase())
                  );
                  setStudentSearchResults(results);
                } else {
                  setStudentSearchResults([]);
                }
              }}
            />
            {studentSearchResults.length > 0 && (
              <div className="mt-1 max-h-40 overflow-y-auto bg-white border border-gray-300 rounded">
                {studentSearchResults.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                    onClick={() => {
                      setStudentSearch(`${s.first_name} ${s.last_name}`);
                      setSelectedStudentName(`${s.first_name} ${s.last_name}`);
                      setStudentSearchResults([]);
                      setRequest((prev) => ({ ...prev, studentId: s.id }))
                    }}
                  >
                    {s.first_name} {s.last_name} ({s.student_number})
                  </button>
                ))}
              </div>
            )}
          </div>
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
