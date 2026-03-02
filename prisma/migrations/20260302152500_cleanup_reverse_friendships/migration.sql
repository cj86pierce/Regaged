-- Remove reverse friendships that were auto-created by old mutual-add code.
-- When A added B, old code created (A,B) first then (B,A) - so (B,A) has larger id.
-- Delete the second-created row (the reverse duplicate).
DELETE FROM "Friendship" f1
USING "Friendship" f2
WHERE f2."userId" = f1."friendId"
  AND f2."friendId" = f1."userId"
  AND f2."createdAt" = f1."createdAt"
  AND f1."id" > f2."id";
