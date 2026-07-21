-- Add 'in_kind' to fee_payments.payment_method CHECK constraint
-- The PaymentModal already offers "In Kind (Goods/Services)" as an option,
-- but the DB constraint only allowed cash, mobile_money, bank, installment.

ALTER TABLE fee_payments DROP CONSTRAINT IF EXISTS fee_payments_payment_method_check;
ALTER TABLE fee_payments ADD CONSTRAINT fee_payments_payment_method_check
  CHECK (payment_method IN ('cash', 'mobile_money', 'bank', 'installment', 'in_kind'));
