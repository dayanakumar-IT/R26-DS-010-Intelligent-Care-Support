-- ============================================================
-- 0043_pdedu_trainer_seed_content.sql
-- Parkinson's-Disease EDUcation (pdedu_) — Symptom Trainer starter
-- content: education-card fields, two more symptoms, per-question
-- tips, and a video-MCQ question bank.
--
-- Draft educational content for a research prototype — symptom-
-- recognition training for caregivers, NOT verified clinical
-- material and NOT diagnostic. Requires domain/clinical review
-- before real use.
--
-- Safe to rerun: fixed ids + ON CONFLICT upserts.
--
-- Depends on: 0042_pdedu_gamified_trainer.sql
-- ============================================================

-- ------------------------------------------------------------
-- Education-card fields for the four existing symptoms + two new
-- ones (postural_instability, shuffling_gait). `definition` doubles
-- as the short description shown on the card.
-- ------------------------------------------------------------
update pdedu_symptoms set
  learning_tip = 'Watch how the speed and size of repeated movements change - taps, buttoning, rising from a chair.',
  memory_trick = 'Brady = slow movement.',
  display_order = 1
where id = 'bradykinesia';

update pdedu_symptoms set
  learning_tip = 'Look at the hand or fingers while the limb is fully at rest, then watch it settle when the person reaches for something.',
  memory_trick = 'Rest = shake, move = settle.',
  display_order = 2
where id = 'tremor';

update pdedu_symptoms set
  learning_tip = 'Notice unusual stiffness when gently moving a limb, and a reduced natural arm swing when walking.',
  memory_trick = 'Rigid = resists movement.',
  display_order = 3
where id = 'rigidity';

update pdedu_symptoms set
  learning_tip = 'Watch the feet at doorways, turns and the first step - a brief "stuck to the floor" pause is the clue.',
  memory_trick = 'Freeze = feet stuck, especially at transitions.',
  display_order = 5
where id = 'freezing_of_gait';

insert into pdedu_symptoms (id, display_name, definition, learning_tip, memory_trick, display_order, is_active) values
  ('postural_instability', 'Postural instability',
   'Reduced balance and stability, especially when starting to move, turning, or when gently nudged - the person may take extra steps to catch themselves or feel unsteady on standing.',
   'Watch balance during turns and standing up, and whether the person needs support or takes small correcting steps.',
   'Posture wobble = balance problem.',
   4, true),
  ('shuffling_gait', 'Shuffling gait',
   'A walking pattern with short, low steps where the feet barely leave the floor, often with reduced arm swing and a slightly stooped posture.',
   'Look at step length and foot clearance - short, sliding steps rather than a normal heel-to-toe stride.',
   'Shuffle = short, sliding steps.',
   6, true)
on conflict (id) do update set
  display_name = excluded.display_name,
  definition = excluded.definition,
  learning_tip = excluded.learning_tip,
  memory_trick = excluded.memory_trick,
  display_order = excluded.display_order,
  is_active = excluded.is_active;

-- ------------------------------------------------------------
-- Per-question practical tips for the 12 existing text questions
-- (0037). extra_fact stays as the "why", tip is the "what to watch".
-- ------------------------------------------------------------
update pdedu_questions set tip = 'Watch a resting hand, then watch it as the person reaches for something.'
  where id in ('a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003');
update pdedu_questions set tip = 'Time everyday repeated actions - taps, buttoning, rising from a chair.'
  where id in ('a0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000006');
update pdedu_questions set tip = 'Gently move a relaxed limb and feel for stiffness or resistance.'
  where id in ('a0000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-000000000009');
update pdedu_questions set tip = 'Watch the feet at doorways, turns, and the first step.'
  where id in ('a0000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000012');

-- ------------------------------------------------------------
-- New TEXT questions — postural_instability + shuffling_gait
-- (3 each), to match the coverage the other symptoms already have.
-- ------------------------------------------------------------
insert into pdedu_questions (id, symptom_id, question_type, format, prompt, choices, extra_fact, tip, difficulty, is_active) values
('a0000000-0000-4000-8000-000000000013', 'postural_instability', 'direct', 'text',
 'Which best describes postural instability?',
 '[
   {"symptom_id":"postural_instability","label":"Reduced balance and steadiness, especially when turning or standing"},
   {"symptom_id":"bradykinesia","label":"Movements becoming slower and smaller than before"},
   {"symptom_id":"tremor","label":"Shaking that happens mostly at rest and eases with movement"},
   {"symptom_id":"rigidity","label":"Muscles feeling tight and resistant when moved"}
 ]'::jsonb,
 'Postural instability is a balance problem and is an important contributor to fall risk.',
 'Watch balance during turns and when the person first stands up.',
 'easy', true),

('a0000000-0000-4000-8000-000000000014', 'postural_instability', 'direct', 'text',
 'A person needs to take several quick, small steps backward to avoid falling after a gentle nudge. This is most associated with:',
 '[
   {"symptom_id":"postural_instability","label":"Postural instability"},
   {"symptom_id":"shuffling_gait","label":"Shuffling gait"},
   {"symptom_id":"tremor","label":"Tremor"},
   {"symptom_id":"rigidity","label":"Rigidity"}
 ]'::jsonb,
 'Needing corrective steps to recover balance points to reduced postural stability.',
 'Only assess balance safely - stay close and never actually let someone fall.',
 'medium', true),

('a0000000-0000-4000-8000-000000000015', 'postural_instability', 'scenario', 'text',
 'While turning around in the kitchen, a person suddenly feels unsteady and grabs the counter for support. Over weeks this happens more often. This is most consistent with:',
 '[
   {"symptom_id":"tremor","label":"Tremor"},
   {"symptom_id":"bradykinesia","label":"Bradykinesia"},
   {"symptom_id":"postural_instability","label":"Postural instability"},
   {"symptom_id":"rigidity","label":"Rigidity"}
 ]'::jsonb,
 'Unsteadiness that is worst during turns and transitions is a common pattern in postural instability.',
 'Turns and direction changes are where balance problems show up first.',
 'medium', true)
on conflict (id) do update set
  symptom_id = excluded.symptom_id, question_type = excluded.question_type, format = excluded.format,
  prompt = excluded.prompt, choices = excluded.choices, extra_fact = excluded.extra_fact,
  tip = excluded.tip, difficulty = excluded.difficulty, is_active = excluded.is_active;

insert into pdedu_questions (id, symptom_id, question_type, format, prompt, choices, extra_fact, tip, difficulty, is_active) values
('a0000000-0000-4000-8000-000000000016', 'shuffling_gait', 'direct', 'text',
 'Shuffling gait is best described as:',
 '[
   {"symptom_id":"shuffling_gait","label":"Short, low steps where the feet barely leave the floor"},
   {"symptom_id":"freezing_of_gait","label":"A sudden inability to move the feet forward while walking"},
   {"symptom_id":"postural_instability","label":"Losing balance easily when turning or nudged"},
   {"symptom_id":"bradykinesia","label":"All movements taking longer than they used to"}
 ]'::jsonb,
 'Shuffling gait refers to the step pattern itself - short, sliding steps with low foot clearance.',
 'Compare step length and how far the feet lift to a normal heel-to-toe stride.',
 'easy', true),

('a0000000-0000-4000-8000-000000000017', 'shuffling_gait', 'comparison', 'text',
 'What most helps tell shuffling gait apart from freezing of gait?',
 '[
   {"symptom_id":"shuffling_gait","label":"Shuffling is a continuous short-stepped pattern; freezing is a sudden brief stop"},
   {"symptom_id":"freezing_of_gait","label":"Shuffling only happens at doorways; freezing happens everywhere"},
   {"symptom_id":"rigidity","label":"Shuffling is caused by stiff arms; freezing is caused by tremor"},
   {"symptom_id":"tremor","label":"They are the same thing with different names"}
 ]'::jsonb,
 'Shuffling is how the person walks throughout; freezing is an abrupt, temporary halt, often at transitions.',
 'Ask: is it the whole walk that looks different, or a sudden stop mid-walk?',
 'hard', true),

('a0000000-0000-4000-8000-000000000018', 'shuffling_gait', 'scenario', 'text',
 'A person walks down the hallway with very short steps, feet barely lifting off the floor, and almost no arm swing. This is most consistent with:',
 '[
   {"symptom_id":"tremor","label":"Tremor"},
   {"symptom_id":"shuffling_gait","label":"Shuffling gait"},
   {"symptom_id":"postural_instability","label":"Postural instability"},
   {"symptom_id":"rigidity","label":"Rigidity"}
 ]'::jsonb,
 'Short steps with low foot clearance and reduced arm swing together describe a shuffling gait.',
 'Step length + foot clearance + arm swing, all reduced together.',
 'medium', true)
on conflict (id) do update set
  symptom_id = excluded.symptom_id, question_type = excluded.question_type, format = excluded.format,
  prompt = excluded.prompt, choices = excluded.choices, extra_fact = excluded.extra_fact,
  tip = excluded.tip, difficulty = excluded.difficulty, is_active = excluded.is_active;

-- ------------------------------------------------------------
-- VIDEO question bank — 2 per symptom (12 total). The clip shown is
-- the demo video for the row's symptom_id, served WITHOUT the
-- symptom_id by GET /pdedu/quiz/questions/{id}/demo-video, so the
-- answer is never leaked. Quiz start only serves a video question
-- when that symptom actually has a usable uploaded video.
-- ------------------------------------------------------------
insert into pdedu_questions (id, symptom_id, question_type, format, prompt, choices, extra_fact, tip, difficulty, is_active) values
-- BRADYKINESIA
('b0000000-0000-4000-8000-000000000001', 'bradykinesia', 'direct', 'video',
 'Which movement pattern is being demonstrated in this clip?',
 '[
   {"symptom_id":"bradykinesia","label":"Bradykinesia"},
   {"symptom_id":"tremor","label":"Tremor"},
   {"symptom_id":"rigidity","label":"Rigidity"},
   {"symptom_id":"freezing_of_gait","label":"Freezing of gait"}
 ]'::jsonb,
 'The repeated movement gets slower and smaller as it continues - a key feature of bradykinesia.',
 'Watch whether repeated taps or gestures shrink and slow down.',
 'medium', true),
('b0000000-0000-4000-8000-000000000002', 'bradykinesia', 'direct', 'video',
 'This clip shows an everyday task. Which movement pattern does it best illustrate?',
 '[
   {"symptom_id":"tremor","label":"Tremor"},
   {"symptom_id":"bradykinesia","label":"Bradykinesia"},
   {"symptom_id":"postural_instability","label":"Postural instability"},
   {"symptom_id":"shuffling_gait","label":"Shuffling gait"}
 ]'::jsonb,
 'The action is completed but noticeably slowly and with reduced range - general slowing of movement.',
 'Compare the speed and size of the action to how it would normally look.',
 'medium', true),
-- TREMOR
('b0000000-0000-4000-8000-000000000003', 'tremor', 'direct', 'video',
 'Which movement pattern is being demonstrated in this clip?',
 '[
   {"symptom_id":"tremor","label":"Tremor"},
   {"symptom_id":"bradykinesia","label":"Bradykinesia"},
   {"symptom_id":"rigidity","label":"Rigidity"},
   {"symptom_id":"postural_instability","label":"Postural instability"}
 ]'::jsonb,
 'A rhythmic shake is visible while the hand rests and eases when the hand is used - a resting tremor.',
 'Look at the hand while it is still, then while it reaches.',
 'easy', true),
('b0000000-0000-4000-8000-000000000004', 'tremor', 'direct', 'video',
 'What is the main movement feature shown here?',
 '[
   {"symptom_id":"freezing_of_gait","label":"Freezing of gait"},
   {"symptom_id":"rigidity","label":"Rigidity"},
   {"symptom_id":"tremor","label":"Tremor"},
   {"symptom_id":"shuffling_gait","label":"Shuffling gait"}
 ]'::jsonb,
 'The rhythmic oscillation of the resting limb is the defining feature of tremor.',
 'Rhythm and "at rest" are the clues.',
 'medium', true),
-- RIGIDITY
('b0000000-0000-4000-8000-000000000005', 'rigidity', 'direct', 'video',
 'Which movement pattern is being demonstrated in this clip?',
 '[
   {"symptom_id":"rigidity","label":"Rigidity"},
   {"symptom_id":"tremor","label":"Tremor"},
   {"symptom_id":"bradykinesia","label":"Bradykinesia"},
   {"symptom_id":"freezing_of_gait","label":"Freezing of gait"}
 ]'::jsonb,
 'The limb resists passive movement and moves stiffly through its range - rigidity.',
 'Watch the helper move the limb: smooth and loose, or stiff and resistant?',
 'medium', true),
('b0000000-0000-4000-8000-000000000006', 'rigidity', 'direct', 'video',
 'While walking in this clip, which feature is most visible?',
 '[
   {"symptom_id":"postural_instability","label":"Postural instability"},
   {"symptom_id":"rigidity","label":"Rigidity"},
   {"symptom_id":"tremor","label":"Tremor"},
   {"symptom_id":"bradykinesia","label":"Bradykinesia"}
 ]'::jsonb,
 'One arm barely swings and is held stiffly against the body - reduced arm swing from rigidity.',
 'Compare the two arms while the person walks.',
 'hard', true),
-- FREEZING OF GAIT
('b0000000-0000-4000-8000-000000000007', 'freezing_of_gait', 'direct', 'video',
 'Which movement pattern is being demonstrated in this clip?',
 '[
   {"symptom_id":"freezing_of_gait","label":"Freezing of gait"},
   {"symptom_id":"shuffling_gait","label":"Shuffling gait"},
   {"symptom_id":"bradykinesia","label":"Bradykinesia"},
   {"symptom_id":"tremor","label":"Tremor"}
 ]'::jsonb,
 'The feet briefly stop as if stuck to the floor at a transition, then movement resumes - freezing of gait.',
 'Watch the feet at the doorway or turn for a sudden brief halt.',
 'medium', true),
('b0000000-0000-4000-8000-000000000008', 'freezing_of_gait', 'direct', 'video',
 'What happens to this person''s walking in the clip?',
 '[
   {"symptom_id":"rigidity","label":"Rigidity"},
   {"symptom_id":"freezing_of_gait","label":"Freezing of gait"},
   {"symptom_id":"postural_instability","label":"Postural instability"},
   {"symptom_id":"tremor","label":"Tremor"}
 ]'::jsonb,
 'A sudden, temporary block of forward stepping - usually at a start, turn, or doorway - is freezing of gait.',
 'It is a sudden stop, not a slow or short-stepped walk.',
 'medium', true),
-- POSTURAL INSTABILITY
('b0000000-0000-4000-8000-000000000009', 'postural_instability', 'direct', 'video',
 'Which movement pattern is being demonstrated in this clip?',
 '[
   {"symptom_id":"postural_instability","label":"Postural instability"},
   {"symptom_id":"shuffling_gait","label":"Shuffling gait"},
   {"symptom_id":"rigidity","label":"Rigidity"},
   {"symptom_id":"bradykinesia","label":"Bradykinesia"}
 ]'::jsonb,
 'The person is unsteady during a turn and takes extra steps to keep their balance - postural instability.',
 'Turns and standing up are where balance problems appear.',
 'medium', true),
('b0000000-0000-4000-8000-000000000010', 'postural_instability', 'direct', 'video',
 'What is the main safety-relevant feature shown here?',
 '[
   {"symptom_id":"tremor","label":"Tremor"},
   {"symptom_id":"postural_instability","label":"Postural instability"},
   {"symptom_id":"freezing_of_gait","label":"Freezing of gait"},
   {"symptom_id":"bradykinesia","label":"Bradykinesia"}
 ]'::jsonb,
 'Loss of steady balance with corrective stepping raises fall risk - postural instability.',
 'Look for reaching for support or small catch-up steps.',
 'hard', true),
-- SHUFFLING GAIT
('b0000000-0000-4000-8000-000000000011', 'shuffling_gait', 'direct', 'video',
 'Which movement pattern is being demonstrated in this clip?',
 '[
   {"symptom_id":"shuffling_gait","label":"Shuffling gait"},
   {"symptom_id":"freezing_of_gait","label":"Freezing of gait"},
   {"symptom_id":"postural_instability","label":"Postural instability"},
   {"symptom_id":"tremor","label":"Tremor"}
 ]'::jsonb,
 'Short steps with the feet barely leaving the floor and little arm swing - a shuffling gait.',
 'Step length and foot clearance are the clues.',
 'easy', true),
('b0000000-0000-4000-8000-000000000012', 'shuffling_gait', 'direct', 'video',
 'How would you describe this person''s walking pattern?',
 '[
   {"symptom_id":"rigidity","label":"Rigidity"},
   {"symptom_id":"bradykinesia","label":"Bradykinesia"},
   {"symptom_id":"shuffling_gait","label":"Shuffling gait"},
   {"symptom_id":"freezing_of_gait","label":"Freezing of gait"}
 ]'::jsonb,
 'The continuous short, sliding, low steps throughout the walk describe a shuffling gait.',
 'The whole walk looks short-stepped - not one sudden stop.',
 'medium', true)
on conflict (id) do update set
  symptom_id = excluded.symptom_id, question_type = excluded.question_type, format = excluded.format,
  prompt = excluded.prompt, choices = excluded.choices, extra_fact = excluded.extra_fact,
  tip = excluded.tip, difficulty = excluded.difficulty, is_active = excluded.is_active;
