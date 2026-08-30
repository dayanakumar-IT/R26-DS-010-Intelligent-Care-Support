-- ============================================================
-- 0037_pdedu_seed_content.sql
-- Parkinson's-Disease EDUcation (pdedu_) — starter symptom + quiz
-- content. Safe to rerun (ON CONFLICT upserts by fixed id).
--
-- Draft educational content for research prototype.
-- Requires domain/clinical review before use as verified caregiver
-- education material.
--
-- Depends on: pdedu_symptoms, pdedu_questions (0036)
-- ============================================================

-- ------------------------------------------------------------
-- Symptoms
-- ------------------------------------------------------------
insert into pdedu_symptoms (id, display_name, definition, is_active) values
  ('tremor', 'Tremor',
   'An involuntary, rhythmic shaking, most often seen in a hand or fingers at rest, that lessens or stops when the person moves that limb purposefully.',
   true),
  ('bradykinesia', 'Bradykinesia',
   'A general slowness of movement - everyday actions like buttoning a shirt, walking, or turning over in bed take noticeably longer and can look smaller or more effortful than before.',
   true),
  ('rigidity', 'Rigidity',
   'Stiffness and increased resistance in the muscles and joints, which can make limbs feel tight and reduce the natural swing of an arm when walking.',
   true),
  ('freezing_of_gait', 'Freezing of gait',
   'A sudden, brief inability to move the feet forward, as if they are stuck to the floor - especially when starting to walk, turning, or approaching a doorway - often paired with balance difficulty that increases fall risk.',
   true)
on conflict (id) do update set
  display_name = excluded.display_name,
  definition = excluded.definition,
  is_active = excluded.is_active;

-- ------------------------------------------------------------
-- Questions — 3 per symptom (Q1 direct, Q2 direct, Q3 scenario).
-- Fixed ids so this insert is safely re-runnable.
-- ------------------------------------------------------------

-- TREMOR
insert into pdedu_questions (id, symptom_id, question_type, prompt, choices, extra_fact, is_active) values
('a0000000-0000-4000-8000-000000000001', 'tremor', 'direct',
 'Which best describes tremor?',
 '[
   {"symptom_id":"tremor","label":"Shaking that happens mostly at rest and eases with purposeful movement"},
   {"symptom_id":"bradykinesia","label":"Slow movements that make actions take longer"},
   {"symptom_id":"freezing_of_gait","label":"A sudden inability to move the feet forward while walking"},
   {"symptom_id":"rigidity","label":"Muscles feeling tight and resistant when moved"}
 ]'::jsonb,
 'A resting tremor is usually most noticeable while the limb is relaxed and may reduce during purposeful movement.',
 true),

('a0000000-0000-4000-8000-000000000002', 'tremor', 'direct',
 'A resting tremor typically becomes LESS noticeable when the person:',
 '[
   {"symptom_id":"tremor","label":"Purposefully reaches for or uses that limb"},
   {"symptom_id":"bradykinesia","label":"Tries to begin a movement after sitting still for a while"},
   {"symptom_id":"rigidity","label":"Has their arm passively moved by someone else"},
   {"symptom_id":"freezing_of_gait","label":"Approaches a doorway while walking"}
 ]'::jsonb,
 'Changes during purposeful movement can help distinguish a resting tremor from other movement problems.',
 true),

('a0000000-0000-4000-8000-000000000003', 'tremor', 'scenario',
 'You notice a person''s hand shaking gently while it rests, but the shaking reduces when they reach for an object. This pattern is most consistent with:',
 '[
   {"symptom_id":"tremor","label":"Tremor"},
   {"symptom_id":"bradykinesia","label":"Bradykinesia"},
   {"symptom_id":"rigidity","label":"Rigidity"},
   {"symptom_id":"freezing_of_gait","label":"Freezing of gait"}
 ]'::jsonb,
 'The useful clue in this scenario is that the shaking is most obvious at rest and decreases during purposeful movement.',
 true)
on conflict (id) do update set
  symptom_id = excluded.symptom_id, question_type = excluded.question_type,
  prompt = excluded.prompt, choices = excluded.choices,
  extra_fact = excluded.extra_fact, is_active = excluded.is_active;

-- BRADYKINESIA
insert into pdedu_questions (id, symptom_id, question_type, prompt, choices, extra_fact, is_active) values
('a0000000-0000-4000-8000-000000000004', 'bradykinesia', 'direct',
 'Bradykinesia mainly refers to:',
 '[
   {"symptom_id":"bradykinesia","label":"Movements becoming slower and often smaller than before"},
   {"symptom_id":"tremor","label":"Shaking that happens mostly at rest and eases with purposeful movement"},
   {"symptom_id":"rigidity","label":"Muscles feeling tight and resistant when moved"},
   {"symptom_id":"freezing_of_gait","label":"A sudden inability to move the feet forward while walking"}
 ]'::jsonb,
 'Bradykinesia can affect both larger movements and fine motor tasks.',
 true),

('a0000000-0000-4000-8000-000000000005', 'bradykinesia', 'direct',
 'Which everyday change may be associated with bradykinesia?',
 '[
   {"symptom_id":"bradykinesia","label":"Taking much longer than usual to button a shirt"},
   {"symptom_id":"tremor","label":"A hand shaking gently while resting on the lap"},
   {"symptom_id":"rigidity","label":"An arm feeling stiff when someone else tries to move it"},
   {"symptom_id":"freezing_of_gait","label":"Feet suddenly stopping while walking through a doorway"}
 ]'::jsonb,
 'Fine motor activities can become slower and more effortful.',
 true),

('a0000000-0000-4000-8000-000000000006', 'bradykinesia', 'scenario',
 'A person used to rise from a chair quickly. Lately the movement takes longer and occurs in smaller, more effortful steps. This is most consistent with:',
 '[
   {"symptom_id":"tremor","label":"Tremor"},
   {"symptom_id":"bradykinesia","label":"Bradykinesia"},
   {"symptom_id":"rigidity","label":"Rigidity"},
   {"symptom_id":"freezing_of_gait","label":"Freezing of gait"}
 ]'::jsonb,
 'General slowing and reduced movement size are important features of bradykinesia.',
 true)
on conflict (id) do update set
  symptom_id = excluded.symptom_id, question_type = excluded.question_type,
  prompt = excluded.prompt, choices = excluded.choices,
  extra_fact = excluded.extra_fact, is_active = excluded.is_active;

-- RIGIDITY
insert into pdedu_questions (id, symptom_id, question_type, prompt, choices, extra_fact, is_active) values
('a0000000-0000-4000-8000-000000000007', 'rigidity', 'direct',
 'Rigidity refers to:',
 '[
   {"symptom_id":"rigidity","label":"Increased stiffness and resistance in the muscles"},
   {"symptom_id":"tremor","label":"Shaking that happens mostly at rest and eases with purposeful movement"},
   {"symptom_id":"bradykinesia","label":"Slow movements that make actions take longer"},
   {"symptom_id":"freezing_of_gait","label":"A sudden inability to move the feet forward while walking"}
 ]'::jsonb,
 'Rigidity describes increased resistance or stiffness during movement.',
 true),

('a0000000-0000-4000-8000-000000000008', 'rigidity', 'direct',
 'A reduced natural arm swing while walking may be associated with:',
 '[
   {"symptom_id":"rigidity","label":"Rigidity"},
   {"symptom_id":"tremor","label":"Tremor"},
   {"symptom_id":"bradykinesia","label":"Bradykinesia"},
   {"symptom_id":"freezing_of_gait","label":"Freezing of gait"}
 ]'::jsonb,
 'Changes in natural arm movement can sometimes accompany rigidity.',
 true),

('a0000000-0000-4000-8000-000000000009', 'rigidity', 'scenario',
 'While helping a person move their arm, the limb feels unusually stiff and resistant. This is most consistent with:',
 '[
   {"symptom_id":"tremor","label":"Tremor"},
   {"symptom_id":"bradykinesia","label":"Bradykinesia"},
   {"symptom_id":"rigidity","label":"Rigidity"},
   {"symptom_id":"freezing_of_gait","label":"Freezing of gait"}
 ]'::jsonb,
 'Resistance or stiffness during movement is a key feature associated with rigidity.',
 true)
on conflict (id) do update set
  symptom_id = excluded.symptom_id, question_type = excluded.question_type,
  prompt = excluded.prompt, choices = excluded.choices,
  extra_fact = excluded.extra_fact, is_active = excluded.is_active;

-- FREEZING OF GAIT
insert into pdedu_questions (id, symptom_id, question_type, prompt, choices, extra_fact, is_active) values
('a0000000-0000-4000-8000-000000000010', 'freezing_of_gait', 'direct',
 'Freezing of gait describes:',
 '[
   {"symptom_id":"freezing_of_gait","label":"A brief moment where the feet seem stuck and cannot move forward"},
   {"symptom_id":"tremor","label":"Shaking that happens mostly at rest and eases with purposeful movement"},
   {"symptom_id":"bradykinesia","label":"Slow movements that make actions take longer"},
   {"symptom_id":"rigidity","label":"Muscles feeling tight and resistant when moved"}
 ]'::jsonb,
 'Freezing often occurs during transitions such as starting, turning, or approaching narrow spaces.',
 true),

('a0000000-0000-4000-8000-000000000011', 'freezing_of_gait', 'direct',
 'Why is freezing of gait particularly important for caregivers to recognise?',
 '[
   {"symptom_id":"freezing_of_gait","label":"It can increase the risk of falls"},
   {"symptom_id":"tremor","label":"It can make holding small objects more difficult"},
   {"symptom_id":"bradykinesia","label":"It can make daily tasks take longer to finish"},
   {"symptom_id":"rigidity","label":"It can make limbs feel stiff during repositioning"}
 ]'::jsonb,
 'Freezing episodes can interrupt walking unexpectedly and may increase fall risk.',
 true),

('a0000000-0000-4000-8000-000000000012', 'freezing_of_gait', 'scenario',
 'A person is walking normally down a hallway, but at a doorway their feet suddenly stop moving for several seconds despite trying to continue. This is most consistent with:',
 '[
   {"symptom_id":"tremor","label":"Tremor"},
   {"symptom_id":"bradykinesia","label":"Bradykinesia"},
   {"symptom_id":"rigidity","label":"Rigidity"},
   {"symptom_id":"freezing_of_gait","label":"Freezing of gait"}
 ]'::jsonb,
 'Doorways, turning, and movement transitions can trigger freezing episodes.',
 true)
on conflict (id) do update set
  symptom_id = excluded.symptom_id, question_type = excluded.question_type,
  prompt = excluded.prompt, choices = excluded.choices,
  extra_fact = excluded.extra_fact, is_active = excluded.is_active;
