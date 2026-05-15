-- Sample exercises with full metadata for UI testing
-- Updates existing placeholder rows in-place, inserts genuinely new ones.

-- Step 1: update existing placeholder exercises to add ExerciseDB metadata
UPDATE public.exercises SET
  exercise_db_id    = 'edb-0001',
  instructions      = 'A compound chest exercise using a barbell on a flat bench, targeting the pectorals.
Lie flat on your back on a bench.
Set your grip just wider than shoulder width.
Unrack the bar and lower it to your mid-chest under control.
Press the bar back up to full lockout.
Keep your feet flat on the floor and back slightly arched throughout.',
  target_muscle     = 'pectorals',
  secondary_muscles = '["triceps", "front deltoid", "serratus anterior"]'::jsonb,
  updated_at        = NOW()
WHERE lower(name) = 'barbell bench press' AND lower(equipment) = 'barbell' AND is_custom = false;

UPDATE public.exercises SET
  exercise_db_id    = 'edb-0002',
  instructions      = 'A bodyweight vertical pulling exercise that builds lat width and overall back strength.
Hang from a bar with hands slightly wider than shoulder width.
Engage your core and pull your chest up toward the bar.
Lead with your elbows, squeezing your lats at the top.
Lower yourself fully until arms are straight and repeat.',
  target_muscle     = 'lats',
  secondary_muscles = '["biceps", "rhomboids", "rear deltoid"]'::jsonb,
  updated_at        = NOW()
WHERE lower(name) = 'pull-up' AND is_custom = false;

UPDATE public.exercises SET
  exercise_db_id    = 'edb-0005',
  instructions      = 'A standing press that builds shoulder strength and core stability.
Stand with feet shoulder-width apart, bar at collar-bone height in a front-rack position.
Brace your core and press the bar directly overhead.
Lock out fully at the top with arms straight.
Lower the bar back to shoulder height with control.',
  target_muscle     = 'delts',
  secondary_muscles = '["triceps", "upper traps", "serratus anterior"]'::jsonb,
  updated_at        = NOW()
WHERE lower(name) = 'overhead press' AND lower(equipment) = 'barbell' AND is_custom = false;

UPDATE public.exercises SET
  exercise_db_id    = 'edb-0006',
  instructions      = 'A classic bicep isolation exercise using a barbell.
Stand holding a barbell with an underhand grip, arms fully extended.
Keeping your elbows pinned at your sides, curl the bar to shoulder height.
Squeeze the biceps at the top of the movement.
Lower the bar slowly back to the starting position.',
  target_muscle     = 'biceps',
  secondary_muscles = '["brachialis", "brachioradialis"]'::jsonb,
  updated_at        = NOW()
WHERE lower(name) = 'barbell curl' AND lower(equipment) = 'barbell' AND is_custom = false;

UPDATE public.exercises SET
  exercise_db_id    = 'edb-0007',
  instructions      = 'A bench press variation with a narrower grip that shifts emphasis to the triceps.
Lie flat on a bench and grip the bar with hands about shoulder-width apart.
Lower the bar to your lower chest, keeping elbows close to your body.
Press back up to full lockout, feeling the triceps contract strongly.
Control the descent on every rep.',
  target_muscle     = 'triceps',
  secondary_muscles = '["pectorals", "front deltoid"]'::jsonb,
  updated_at        = NOW()
WHERE lower(name) = 'close grip bench press' AND lower(equipment) = 'barbell' AND is_custom = false;

UPDATE public.exercises SET
  exercise_db_id    = 'edb-0003',
  instructions      = 'The king of lower body exercises, targeting quads, glutes, and overall lower body.
Stand with feet shoulder-width apart, bar across upper traps.
Brace your core and send your hips back and down.
Descend until thighs are at least parallel to the floor.
Drive through your heels to return to standing position.',
  target_muscle     = 'quads',
  secondary_muscles = '["glutes", "hamstrings", "adductors", "lower back"]'::jsonb,
  updated_at        = NOW()
WHERE lower(name) = 'barbell squat' AND lower(equipment) = 'barbell' AND is_custom = false;

UPDATE public.exercises SET
  exercise_db_id    = 'edb-0004',
  instructions      = 'A hip-hinge movement that emphasises hamstring length and glute strength.
Stand with a hip-width stance and bar in an overhand grip.
Hinge at the hips, keeping a neutral spine and slight knee bend.
Lower the bar along your legs until you feel a strong hamstring stretch.
Drive your hips forward to return to standing.',
  target_muscle     = 'hamstrings',
  secondary_muscles = '["glutes", "lower back", "adductors"]'::jsonb,
  updated_at        = NOW()
WHERE lower(name) = 'romanian deadlift' AND lower(equipment) = 'barbell' AND is_custom = false;

UPDATE public.exercises SET
  exercise_db_id    = 'edb-0008',
  instructions      = 'The most effective exercise for glute development and hip extension strength.
Sit with your upper back against a bench and place a barbell over your hips.
Plant feet flat on the floor, hip-width apart.
Drive through your heels to lift your hips until your torso is parallel to the floor.
Squeeze your glutes hard at the top, then lower with control.',
  target_muscle     = 'glutes',
  secondary_muscles = '["hamstrings", "adductors", "lower back"]'::jsonb,
  updated_at        = NOW()
WHERE lower(name) = 'hip thrust' AND lower(equipment) = 'barbell' AND is_custom = false;

UPDATE public.exercises SET
  exercise_db_id    = 'edb-0013',
  instructions      = 'An isolation exercise that builds calf size and ankle strength.
Stand on the calf raise machine with the balls of your feet on the platform.
Lower your heels as far as comfortable to get a full stretch.
Rise up onto your toes as high as possible.
Hold the peak contraction briefly before lowering.',
  target_muscle     = 'calves',
  secondary_muscles = '["soleus"]'::jsonb,
  updated_at        = NOW()
WHERE lower(name) = 'standing calf raise' AND is_custom = false;

UPDATE public.exercises SET
  exercise_db_id    = 'edb-0009',
  instructions      = 'An isometric core exercise that builds anti-extension strength and stability.
Get into a forearm plank position with elbows directly below your shoulders.
Keep your body in a straight line from head to heels.
Brace your core and squeeze your glutes throughout.
Hold for the target duration without letting your hips sag or rise.',
  target_muscle     = 'abs',
  secondary_muscles = '["transverse abdominis", "obliques", "lower back"]'::jsonb,
  updated_at        = NOW()
WHERE lower(name) = 'plank' AND is_custom = false;

UPDATE public.exercises SET
  exercise_db_id    = 'edb-9999',
  instructions      = 'A clean power movement that develops full-body explosive strength.
Stand with the bar over mid-foot, grip just outside your legs.
Drive through the floor, extending hips and knees explosively.
As the bar passes the hips, pull yourself under it into a front-rack position.
Stand up to complete the lift.',
  target_muscle     = 'quads',
  secondary_muscles = '["glutes", "hamstrings", "traps", "rear deltoid"]'::jsonb,
  updated_at        = NOW()
WHERE lower(name) = 'power clean' AND lower(equipment) = 'barbell' AND is_custom = false;

-- Step 2: insert genuinely new exercises that don't conflict
INSERT INTO public.exercises (name, body_part, equipment, instructions, target_muscle, secondary_muscles, exercise_db_id, is_custom, created_by, updated_at)
SELECT * FROM (VALUES

  ('Dumbbell Lateral Raise', 'shoulders', 'dumbbell',
  'An isolation exercise for the lateral deltoid that builds shoulder width.
Stand holding dumbbells at your sides with a slight bend in your elbows.
Raise both arms out to the sides until they reach shoulder height.
Pause briefly at the top of the movement.
Lower the dumbbells slowly back down and repeat.',
  'delts', '["upper traps", "serratus anterior"]'::jsonb, 'edb-0010'),

  ('Cable Row', 'back', 'cable',
  'A horizontal pulling exercise that targets the middle back and improves posture.
Sit at a cable row machine with feet on the platform and knees slightly bent.
Grip the handle with both hands and sit upright.
Pull the handle to your lower abdomen, squeezing your shoulder blades together.
Extend your arms fully and allow your shoulder blades to spread before each rep.',
  'lats', '["rhomboids", "rear deltoid", "biceps", "lower traps"]'::jsonb, 'edb-0011'),

  ('Leg Press', 'upper legs', 'machine',
  'A machine-based quad-dominant pushing exercise that allows heavy loading.
Sit in the leg press machine with your back flat against the pad.
Place feet shoulder-width apart on the platform.
Release the safety handles and lower the platform until knees reach 90 degrees.
Press through your heels to extend your legs without locking out your knees.',
  'quads', '["glutes", "hamstrings", "adductors"]'::jsonb, 'edb-0012'),

  ('Dumbbell Row', 'back', 'dumbbell',
  'A unilateral back exercise that corrects imbalances and builds lat thickness.
Place one knee and hand on a bench for support.
Hold a dumbbell in the opposite hand with arm extended.
Pull the dumbbell up toward your hip, keeping your elbow close to your body.
Squeeze your lat at the top, then lower the dumbbell fully.',
  'lats', '["rhomboids", "rear deltoid", "biceps"]'::jsonb, 'edb-0014'),

  ('Tricep Pushdown', 'upper arms', 'cable',
  'A cable isolation exercise that targets all three heads of the tricep.
Stand at a cable machine with a rope or bar attachment at head height.
Grip the attachment and keep your elbows pinned to your sides.
Push the attachment down until your arms are fully extended.
Slowly allow the cable to return your arms to the starting position.',
  'triceps', '["anconeus"]'::jsonb, 'edb-0015'),

  ('Incline Dumbbell Press', 'chest', 'dumbbell',
  'An upper chest pressing exercise performed on an incline bench.
Set the bench to 30-45 degrees and lie back with dumbbells at shoulder height.
Press both dumbbells up and slightly inward until arms are fully extended.
Lower the dumbbells back to shoulder level under control.
Keep your feet flat on the floor throughout.',
  'pectorals', '["front deltoid", "triceps"]'::jsonb, 'edb-0016'),

  ('Face Pull', 'shoulders', 'cable',
  'A rear-delt and rotator cuff exercise that improves shoulder health and posture.
Set a cable pulley to head height with a rope attachment.
Grip the rope with both hands and step back to create tension.
Pull the rope toward your face, flaring your elbows out to the sides.
Rotate your hands so your thumbs point behind you at the end position.',
  'delts', '["rear deltoid", "rhomboids", "rotator cuff"]'::jsonb, 'edb-0017'),

  ('Leg Curl', 'upper legs', 'machine',
  'A machine isolation exercise that targets the hamstrings through knee flexion.
Lie face down on the leg curl machine with the pad just above your heels.
Curl your legs up toward your glutes as far as the range allows.
Squeeze your hamstrings hard at the top.
Lower the weight slowly and with control.',
  'hamstrings', '["calves", "glutes"]'::jsonb, 'edb-0018'),

  ('Seated Dumbbell Curl', 'upper arms', 'dumbbell',
  'A seated bicep curl that eliminates body English for strict isolation.
Sit on a bench with a dumbbell in each hand, arms hanging at your sides.
Curl both dumbbells simultaneously to shoulder height.
Supinate your wrists at the top so your palms face your shoulders.
Lower slowly and repeat.',
  'biceps', '["brachialis", "brachioradialis"]'::jsonb, 'edb-0019'),

  ('Ab Wheel Rollout', 'waist', 'body weight',
  'An advanced anti-extension core exercise that builds serious abdominal strength.
Kneel on the floor holding an ab wheel with both hands.
Slowly roll the wheel forward, extending your body toward the ground.
Maintain a braced core and flat back throughout.
Pull the wheel back to the start using your abs, not your lower back.',
  'abs', '["obliques", "lats", "lower back"]'::jsonb, 'edb-0020')

) AS v(name, body_part, equipment, instructions, target_muscle, secondary_muscles, exercise_db_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercises e
  WHERE lower(e.name) = lower(v.name)
    AND lower(e.equipment) = lower(v.equipment)
    AND e.is_custom = false
    AND e.created_by IS NULL
)
ON CONFLICT (exercise_db_id) DO UPDATE SET
  instructions      = EXCLUDED.instructions,
  target_muscle     = EXCLUDED.target_muscle,
  secondary_muscles = EXCLUDED.secondary_muscles,
  updated_at        = NOW();

SELECT count(*) AS total_exercises, count(exercise_db_id) AS with_metadata FROM public.exercises WHERE is_custom = false;
