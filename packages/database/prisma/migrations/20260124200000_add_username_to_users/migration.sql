-- AlterTable: Add username column (nullable first)
ALTER TABLE "users" ADD COLUMN "username" TEXT;

-- Generate default usernames from name or email
UPDATE "users"
SET "username" = CASE
  WHEN "name" IS NOT NULL AND "name" != ''
    THEN LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM("name"), '[^a-zA-Z0-9 -]', '', 'g'), '\s+', '-', 'g'))
  ELSE LOWER(REGEXP_REPLACE(SPLIT_PART("email", '@', 1), '[^a-z0-9-]', '-', 'g'))
END;

-- Ensure usernames start with a letter (prepend 'u-' if they don't)
UPDATE "users"
SET "username" = 'u-' || "username"
WHERE "username" !~ '^[a-z]';

-- Truncate usernames longer than 30 chars
UPDATE "users"
SET "username" = LEFT("username", 30)
WHERE LENGTH("username") > 30;

-- Ensure minimum length of 3 chars
UPDATE "users"
SET "username" = "username" || REPEAT('x', 3 - LENGTH("username"))
WHERE LENGTH("username") < 3;

-- Resolve duplicate usernames by appending -2, -3, etc.
WITH duplicates AS (
  SELECT id, "username",
    ROW_NUMBER() OVER (PARTITION BY "username" ORDER BY "createdAt" ASC) as rn
  FROM "users"
)
UPDATE "users"
SET "username" = duplicates."username" || '-' || duplicates.rn
FROM duplicates
WHERE "users".id = duplicates.id AND duplicates.rn > 1;

-- Set NOT NULL constraint
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
