# Direct-solver bake: per-sign summary

Worst side, mean angle between baked and MediaPipe-measured bone direction (agreement with MediaPipe, not ground truth). Hand err = palm direction; finger err = index middle segment. Hand smoothing 0.65, joint limits on.

| sign | frames | L / R hand det. % | hand err | finger err | frames limited (of total) | limited groups | KB |
|---|---|---|---|---|---|---|---|
| afternoon | 79 | 25 / 22 | 29° | 44° | 8 (10%) | leftWrist 6, leftFingers 6, rightWrist 2, rightFingers 1 | 119 |
| angry | 100 | 34 / 34 | 3° | 5° | 14 (14%) | rightFingers 14, leftFingers 3, rightElbow 1 | 147 |
| arm | 83 | 2 / 13 | 27° | 42° | 6 (7%) | rightFingers 4, rightWrist 4, leftWrist 2, leftFingers 2 | 123 |
| back | 65 | 0 / 31 | 36° | 23° | 20 (31%) | rightWrist 20 | 79 |
| bread | 45 | 53 / 49 | 4° | 10° | 0 (0%) | – | 69 |
| call | 46 | 44 / 50 | 7° | 18° | 9 (20%) | rightFingers 8, leftWrist 1, rightElbow 1 | 71 |
| close | 107 | 29 / 28 | 5° | 6° | 4 (4%) | leftWrist 2, rightWrist 1, rightFingers 1 | 157 |
| coffee | 61 | 36 / 48 | 4° | 7° | 12 (20%) | rightFingers 7, leftFingers 5, leftWrist 1 | 93 |
| come | 61 | 0 / 26 | 50° | 106° | 13 (21%) | rightWrist 13, rightFingers 11 | 75 |
| comfortable | 84 | 32 / 32 | 9° | 14° | 21 (25%) | leftWrist 13, rightWrist 9, rightFingers 2, leftFingers 1 | 128 |
| confused | 71 | 32 / 56 | 12° | 24° | 10 (14%) | rightWrist 5, leftFingers 3, rightFingers 2 | 108 |
| cough | 52 | 2 / 52 | 19° | 36° | 23 (44%) | rightWrist 20, rightFingers 5, leftFingers 1 | 80 |
| danger | 64 | 48 / 41 | 12° | 9° | 21 (33%) | leftWrist 19, rightFingers 2, leftFingers 1 | 98 |
| dizzy | 61 | 0 / 43 | 4° | 6° | 1 (2%) | rightWrist 1 | 75 |
| doctor | 108 | 19 / 41 | 13° | 32° | 22 (20%) | leftFingers 20, rightWrist 6, rightFingers 1 | 160 |
| drink | 54 | 0 / 56 | 7° | 7° | 20 (37%) | rightWrist 20 | 67 |
| eat | 73 | 0 / 32 | 5° | 5° | 11 (15%) | rightWrist 11 | 90 |
| egg | 61 | 43 / 52 | 8° | 29° | 12 (20%) | leftFingers 10, rightFingers 2, leftElbow 2, leftWrist 1 | 93 |
| fruit | 63 | 0 / 40 | 28° | 19° | 23 (37%) | rightWrist 22, rightFingers 1 | 78 |
| give | 57 | 0 / 23 | 19° | 33° | 6 (11%) | rightWrist 5, rightFingers 2 | 70 |
| go | 67 | 33 / 33 | 6° | 11° | 7 (10%) | leftWrist 6, rightWrist 4, rightFingers 1 | 101 |
| good | 47 | 15 / 17 | 55° | 67° | 8 (17%) | leftWrist 7, leftFingers 4, rightWrist 1 | 72 |
| happy | 50 | 2 / 60 | 67° | 13° | 5 (10%) | rightWrist 3, rightFingers 3, leftWrist 1 | 77 |
| head | 87 | 0 / 44 | 26° | 11° | 37 (43%) | rightWrist 37 | 105 |
| hello | 66 | 0 / 36 | 9° | 10° | 12 (18%) | rightWrist 12 | 82 |
| help | 58 | 45 / 50 | 17° | 42° | 22 (38%) | leftFingers 20, leftWrist 8, rightFingers 1 | 89 |
| hospital | 67 | 0 / 43 | 19° | 21° | 24 (36%) | rightWrist 23, rightFingers 1 | 81 |
| hot | 71 | 0 / 35 | 6° | 13° | 13 (18%) | rightFingers 12, rightWrist 1 | 88 |
| hungry | 64 | 0 / 41 | 6° | 8° | 3 (5%) | rightFingers 3 | 78 |
| hurt | 68 | 40 / 40 | 4° | 5° | 1 (1%) | leftFingers 1 | 102 |
| me | 55 | 0 / 0 | – | – | 0 (0%) | – | 53 |
| meet | 77 | 38 / 39 | 7° | 8° | 28 (36%) | leftWrist 26, rightWrist 13, rightFingers 2 | 116 |
| milk | 50 | 18 / 60 | 10° | 18° | 3 (6%) | rightWrist 1, leftWrist 1, rightFingers 1 | 77 |
| morning | 84 | 45 / 25 | 9° | 13° | 7 (8%) | rightFingers 4, leftFingers 2, rightWrist 2 | 126 |
| mouth | 184 | 0 / 40 | 4° | 9° | 2 (1%) | rightWrist 2, rightFingers 1 | 221 |
| no | 53 | 0 / 47 | 4° | 10° | 1 (2%) | rightFingers 1 | 66 |
| nose | 96 | 0 / 44 | 3° | 6° | 1 (1%) | rightFingers 1 | 116 |
| open | 85 | 41 / 38 | 5° | 7° | 3 (4%) | rightFingers 2, leftFingers 1 | 127 |
| pain | 128 | 25 / 37 | 7° | 12° | 1 (1%) | leftWrist 1 | 190 |
| please | 79 | 0 / 62 | 3° | 12° | 30 (38%) | rightFingers 30, rightElbow 1 | 96 |
| sad | 95 | 40 / 45 | 7° | 16° | 32 (34%) | leftFingers 31, rightFingers 2, leftElbow 1, leftWrist 1, rightWrist 1 | 143 |
| scared | 65 | 40 / 46 | 4° | 5° | 21 (32%) | rightFingers 21 | 97 |
| sick | 150 | 19 / 23 | 3° | 4° | 2 (1%) | rightFingers 2 | 221 |
| sit | 86 | 41 / 41 | 4° | 6° | 1 (1%) | rightFingers 1 | 128 |
| sleep | 67 | 0 / 36 | 6° | 9° | 14 (21%) | rightWrist 12, rightFingers 2 | 82 |
| sorry | 53 | 0 / 64 | 5° | 3° | 4 (8%) | rightFingers 4 | 66 |
| stand | 90 | 14 / 34 | 47° | 60° | 16 (18%) | leftFingers 9, rightFingers 5, leftWrist 4, leftElbow 1, rightWrist 1 | 135 |
| stomach | 66 | 0 / 56 | 4° | 20° | 32 (48%) | rightFingers 32, rightElbow 6 | 81 |
| stop | 57 | 53 / 30 | 19° | 22° | 27 (47%) | leftFingers 20, rightWrist 13, rightFingers 1 | 87 |
| take | 53 | 0 / 17 | 7° | 8° | 0 (0%) | – | 66 |
| tea | 76 | 43 / 43 | 7° | 14° | 21 (28%) | leftFingers 20, rightFingers 3, rightWrist 2 | 116 |
| thirsty | 58 | 0 / 43 | 4° | 5° | 2 (3%) | rightFingers 2 | 71 |
| tired | 72 | 40 / 46 | 8° | 18° | 21 (29%) | rightWrist 16, leftWrist 13, rightFingers 3 | 109 |
| wait | 71 | 44 / 49 | 2° | 4° | 1 (1%) | leftFingers 1 | 107 |
| walk | 52 | 38 / 40 | 12° | 20° | 9 (17%) | rightFingers 7, leftWrist 2, leftFingers 1 | 80 |
| water | 68 | 0 / 56 | 8° | 9° | 27 (40%) | rightWrist 27 | 81 |
| weak | 41 | 44 / 46 | 33° | 38° | 15 (37%) | leftFingers 15, leftWrist 6, leftElbow 1 | 64 |
| welcome | 74 | 12 / 31 | 50° | 62° | 18 (24%) | leftWrist 9, rightFingers 7, rightWrist 6, leftFingers 6, rightElbow 2 | 113 |
| yes | 46 | 0 / 48 | 6° | 8° | 2 (4%) | rightWrist 1, rightFingers 1 | 57 |