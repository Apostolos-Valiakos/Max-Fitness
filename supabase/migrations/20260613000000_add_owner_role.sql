-- Add 'owner' to user_role enum in its own transaction so it is committed
-- before the SaaS multitenancy migration references it.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';
