-- A training block is no longer a fixed 5 weeks. `end_date` becomes optional
-- so a program can run open-ended and be extended without recreating it.
alter table program alter column end_date drop not null;

-- How far ahead planned workouts have been materialised. Generation only fills
-- dates *after* this watermark, so a session the user deliberately deleted
-- (travel, illness) never silently reappears on the next page load.
alter table program add column scheduled_through date;

-- One session of a given template per day. Makes schedule generation safely
-- idempotent via upsert.
alter table workout add constraint workout_template_date_unique unique (user_id, template_id, date);

-- Sets are logged for both sides together by default — one row per set, the
-- way the paper log recorded "8 per bein" as a single number. Per-side logging
-- (CLAUDE.md §4.5) stays available per exercise, it is just no longer the
-- default for these.
update exercise set is_unilateral = false;
