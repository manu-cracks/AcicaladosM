-- Migration: Remove employee shifts and commission fields
-- Description: Drops shift_start, shift_end, and commission_percentage from public.employees table

ALTER TABLE public.employees 
  DROP COLUMN IF EXISTS shift_start,
  DROP COLUMN IF EXISTS shift_end,
  DROP COLUMN IF EXISTS commission_percentage;
