-- Realign student_fee_balance() with the fee engine the app actually uses.
--
-- The helper was written before the engine grew class-wide fees, boarding
-- applicability, meal/joining gating, opening balances and adjustments, so it
-- disagreed with every screen that shows a balance. It is replaced here with a
-- query over the same inputs calculateStudentFeePosition()/feeAppliesToStudent()
-- read: class-wide OR class-specific lines, boarding_status, meals only for
-- pupils who eat, joining charges only for new admissions, plus opening balance,
-- credits/penalties and payments. Totals are clamped at zero exactly as the
-- TypeScript engine does.
--
-- The JS predicates (meal-fee.ts, new-admission-fee.ts) remain the source of
-- truth; the word lists below mirror them and must move together.

create or replace function public.student_fee_balance(p_student_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select id, class_id, boarding_status, takes_meals, is_new_admission, coalesce(opening_balance, 0) as opening_balance
    from public.students
    where id = p_student_id
  ),
  applicable_fees as (
    select fs.amount
    from public.fee_structure fs
    join s on true
    where fs.deleted_at is null
      and (fs.class_id is null or fs.class_id = s.class_id)
      and (fs.boarding_status is null or fs.boarding_status = coalesce(s.boarding_status, 'day'))
      -- Meals are owed only by a pupil who eats at school.
      and (
        not (coalesce(fs.category, '') || ' ' || coalesce(fs.name, '')
             ~* '\m(meal|meals|lunch|breakfast|supper|canteen|food)\M')
        or s.takes_meals is true
      )
      -- Registration/uniform are joining charges, owed once.
      and (
        not (coalesce(fs.category, '') || ' ' || coalesce(fs.name, '')
             ~* '\m(registr\w*|admission|admit|enrol\w*|intake|joining|entry|uniform\w*)\M')
        or s.is_new_admission is true
      )
  ),
  credit_adjustments as (
    select coalesce(sum(fa.amount), 0) as total
    from public.fee_adjustments fa
    where fa.student_id = p_student_id
      and fa.deleted_at is null
      and fa.adjustment_type in ('discount', 'scholarship', 'manual_credit', 'write_off', 'bursary', 'amnesty')
  ),
  penalty_adjustments as (
    select coalesce(sum(fa.amount), 0) as total
    from public.fee_adjustments fa
    where fa.student_id = p_student_id
      and fa.deleted_at is null
      and fa.adjustment_type = 'penalty'
  ),
  payments as (
    select coalesce(sum(fp.amount_paid), 0) as total
    from public.fee_payments fp
    where fp.student_id = p_student_id and fp.deleted_at is null
  )
  select greatest(0,
    greatest(0,
      (select coalesce(sum(amount), 0) from applicable_fees)
        + (select opening_balance from s)
        + (select total from penalty_adjustments)
        - (select total from credit_adjustments)
    )
    - (select total from payments)
  )
$$;

comment on function public.student_fee_balance(uuid) is
  'Outstanding fee balance for a pupil, matching the app fee engine (class/boarding/meal/joining applicability, opening balance, adjustments, payments). Not an exam gate.';
