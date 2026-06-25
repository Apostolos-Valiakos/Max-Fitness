-- Prevent duplicate pending invites to the same email for the same gym.
-- Allows re-inviting after an invite is accepted (accepted_at IS NOT NULL rows are exempt).
CREATE UNIQUE INDEX IF NOT EXISTS gym_invites_gym_email_pending_uniq
  ON gym_invites (gym_id, email)
  WHERE accepted_at IS NULL;
