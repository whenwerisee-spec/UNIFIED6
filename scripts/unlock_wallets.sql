-- Unlock wallets for email whenwerisee@gmail.com
BEGIN TRANSACTION;
-- Set identityLocked = 0 (false), clear lockedToEmail, and set lockedAt = NULL
UPDATE wallets
SET identityLocked = 0,
    lockedToEmail = '',
    lockedAt = NULL
WHERE user_id IN (SELECT id FROM users WHERE email = 'whenwerisee@gmail.com');

COMMIT;
