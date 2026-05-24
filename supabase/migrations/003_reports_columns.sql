-- Add category and is_recurring to bills table
alter table bills
  add column if not exists category text
    default 'other'
    check (category in ('travel', 'food', 'housing', 'other')),
  add column if not exists is_recurring text
    check (is_recurring in ('monthly', 'yearly') or is_recurring is null);
