-- Three working sets everywhere, for every session and every exercise.
alter table session_template_item alter column target_sets set default 3;
update session_template_item set target_sets = 3 where target_sets <> 3;
