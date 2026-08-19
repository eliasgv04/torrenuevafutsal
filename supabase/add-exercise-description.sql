-- Free-text description for an exercise, shown only in its detail view
-- (ExerciseDetailModal) — separate from the short "objective" one-liner,
-- and deliberately not included in any generated PDF.
alter table exercises add column if not exists description text;
