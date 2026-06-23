-- Add support_phone to schools table for school-level support contact override
alter table public.schools add column if not exists support_phone text;

-- Set the platform default support number as the default for new schools
alter table public.schools alter column support_phone set default '256727790003';

-- Update existing schools that don't have a support_phone to use the platform default
update public.schools set support_phone = '256727790003' where support_phone is null;
