-- exercise_records is no longer used by the app: exercise "veces" is now
-- derived from training_exercises (how many times an exercise was included
-- in a training), and manual registration ("+ Agregar registro") was removed.
drop table if exists exercise_records;
