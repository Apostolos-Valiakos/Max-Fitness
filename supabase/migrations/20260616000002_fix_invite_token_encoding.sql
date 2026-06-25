-- PostgreSQL's encode() does not support 'base64url'.
-- Replace the default with standard base64 translated to URL-safe characters:
--   + → -   /  → _   = (padding) → removed
-- Result is a 32-char URL-safe token equivalent to base64url(24 random bytes).
ALTER TABLE public.gym_invites
  ALTER COLUMN token SET DEFAULT
    translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
