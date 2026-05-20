// File: src/components/PaymentModeSelect.tsx
import React from 'react';
import { Select } from '@/components/ui';
import { PaymentMode } from '@/types/payment';

interface Props {
  value?: PaymentMode;
  onChange: (mode: PaymentMode) => void;
}

export const PaymentModeSelect = ({ value = 'cash', onChange }: Props) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value as PaymentMode);
  };

  return (
    <Select
      value={value}
      onChange={handleChange}
      options={[
        { value: 'cash', label: 'Cash' },
        { value: 'card', label: 'Card' },
        { value: 'online', label: 'Online' },
        { value: 'installments', label: 'Installments' },
      ]}
    />
  );
};
