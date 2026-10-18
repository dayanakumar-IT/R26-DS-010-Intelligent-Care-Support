# SENTRY — Detailed Viva & Presentation Answers (Simple English)
**All Marking Criteria Covered | LO1 → LO5 | Ready to Speak**

IT22057488 — Harishalinee Elangovan

---

## HOW TO USE THIS DOCUMENT
- Every section below maps to one marking criterion from the viva and presentation mark sheets
- Read the answer out loud before the viva — do not just read silently
- Answers are written in simple, spoken English — say them exactly like this

---

---

# PART 1 — PROVEN GAP AND CREATIVE SOLUTION (LO1)

---

## 1.1 What is the research gap? Why does this problem need a new solution?

**Simple English Answer (say this):**

"Patients in hospitals, especially elderly patients or patients recovering from surgery, are at high risk of falling. When a patient falls, it can cause broken bones, head injuries, and sometimes death. The problem is that nurses and caregivers cannot watch every patient all the time — they have many patients to look after.

Current solutions have big problems:

The first type is wearable sensors — like a wristband or a clip that detects movement. The problem is that patients, especially elderly or confused patients, often remove them. They are also uncomfortable and need to be charged.

The second type is PIR sensors or pressure mats on the floor. These can only tell you that something moved or that someone stepped on the mat. They cannot tell you whether the person is about to fall or just getting a glass of water. They detect the fall only after the person has already hit the ground.

The third type is cloud-based video systems. These send the patient's video to a remote server for processing. This is a serious privacy problem — you are sending video of a patient in their bedroom to a cloud server.

So the gap is this: there is no existing system that can watch a patient continuously using a normal camera, understand their body movements in real time, predict that a fall is about to happen before it happens, and do all of this without sending any video outside the room.

SENTRY fills this gap."

---

## 1.2 What literature did you read to find this gap?

**Simple English Answer (say this):**

"I reviewed several categories of existing work.

Yan et al. in 2018 introduced ST-GCN — a graph neural network for skeleton-based action recognition. Their work was the foundation for our model, but they applied it to action recognition on studio datasets, not to clinical fall risk detection in a real hospital setting.

Núñez et al. in 2021 demonstrated pose estimation on an edge device for fall detection. But they used a simple single threshold — if the person's joint drops below a certain height, it triggers an alarm. This has too many false alarms and no temporal understanding.

Zhang et al. in 2020 used LSTM on skeleton joints. The problem with LSTM is that it processes each joint separately, so it cannot capture the relationship between joints — for example, that the hips and knees collapse together during a fall.

Commercial systems like Tunstall and Fall Call use wearable devices and PIR sensors — all with the limitations I mentioned.

After reviewing all of these, I concluded that no prior system combines: edge-only inference, skeleton-based spatiotemporal modelling, posture-aware false alarm reduction, and a complete caregiver alert pipeline — all in one system. That is the gap SENTRY addresses."

---

## 1.3 What is novel about SENTRY? How is it different from existing systems?

**Simple English Answer (say this):**

"SENTRY has four things that no existing system has together at the same time.

**First novelty — Late Fusion architecture.** Most systems either use a graph neural network OR handcrafted features. SENTRY uses both at the same time and combines their outputs. The graph network (ST-GCN) captures how joints move together over time. The 18 handcrafted features capture specific clinical measurements like how much the person is leaning forward, how fast their hips are dropping, and whether their knees are collapsing. Combining both gives better accuracy than either alone.

**Second novelty — Posture-aware false alarm reduction.** If a patient is sitting in a chair and moves their arms quickly, many systems would generate a false HIGH alert. SENTRY knows the patient is sitting down, so it caps the risk level at MODERATE. But — and this is important — if the patient starts to stand up, the system switches to TRANSITION mode and becomes MORE sensitive, not less. We have automated tests that prove this.

**Third novelty — Passive zone calibration.** The system watches where the patient moves for 60 to 90 seconds and automatically learns where the bed is, where the chair is, and where the walking area is. No one has to draw a map of the room manually.

**Fourth novelty — Privacy-preserving edge deployment.** All processing happens on the device in the room. No video is ever sent over the network. The web dashboard shows a skeleton — just dots and lines — not the patient's actual image."

---

---

# PART 2 — DOMAIN KNOWLEDGE (LO2)

---

## 2.1 Explain the general domain — what is fall risk detection?

**Simple English Answer (say this):**

"Fall risk detection is the problem of identifying, in real time, whether a person is about to fall or is at high risk of falling — before the fall actually happens.

This is different from fall detection, which detects that a person has already fallen. Fall risk detection is about prevention.

In a hospital ward, the goal is to alert a caregiver when a patient's risk is rising, so the caregiver can go check on the patient before any injury happens.

The domain involves three areas of knowledge working together:
- Computer vision: extracting the patient's body position from a camera feed
- Machine learning: understanding whether the body movement pattern is dangerous
- Healthcare systems: delivering the alert to the right caregiver at the right time

SENTRY covers all three."

---

## 2.2 Explain how the specific technique — ST-GCN — works and why you chose it

**Simple English Answer (say this):**

"ST-GCN stands for Spatial Temporal Graph Convolutional Network.

Let me explain it step by step.

A human skeleton is a graph. The joints — like shoulders, elbows, hips, knees — are the nodes of the graph. The bones connecting them — like the upper arm connecting shoulder to elbow — are the edges.

When a person moves, the joints move in patterns that are related to each other. For example, when someone falls forward, their hips go down, their knees bend, and their arms extend to protect themselves. These movements happen together, across joints, across time.

LSTM — another common approach — processes each time step one by one and treats joints as a flat list. It cannot capture the relationship between the hip and the knee at the same moment.

ST-GCN processes the entire skeleton as a graph at every time step AND looks at how the graph changes over time. So it captures both: which joints move together (spatial) and how the movement evolves over time (temporal).

I chose ST-GCN because it is the most appropriate model for skeleton-based movement analysis. It has been validated on large benchmark datasets and is computationally efficient enough to run on an edge device without a GPU."

---

## 2.3 What are alternatives to ST-GCN and why did you not use them?

**Simple English Answer (say this):**

"The main alternatives are:

**LSTM or GRU:** Good at temporal patterns but treats joints as independent features in a flat vector. Cannot model the spatial relationship between joints. Lower accuracy on fall detection benchmarks.

**CNN on video frames:** Processes raw video pixels. Requires much more computation, is sensitive to lighting and clothing changes, and requires sending or storing raw video — privacy problem.

**Optical flow methods:** Measures pixel movement between frames. Very sensitive to background movement (like curtains blowing) and camera shake. High false alarm rate in clinical environments.

**Simple threshold on joint positions:** Easy to implement but no temporal context. If someone bends down to pick something up, it looks identical to a fall starting.

I chose ST-GCN because it avoids all of these problems: it works on skeleton data (not raw video), it models spatial joint relationships, it has temporal context, and it runs efficiently on CPU."

---

## 2.4 Explain the 18 handcrafted biomechanical features — why 18 and not just ST-GCN alone?

**Simple English Answer (say this):**

"ST-GCN learns patterns from data, but it is a black box — it does not know what a hip height or a torso lean angle is. The 18 handcrafted features encode specific clinical knowledge about what falling looks like.

For example:
- F2 is the downward velocity of the body's centre of mass — how fast the person is dropping toward the floor
- F3 is the torso lean angle — if someone is leaning more than 45 degrees, they are in danger of falling
- F4 is the hip height normalised to the frame — if hips are very low in the frame, the person is close to the ground
- F17 is the bounding box height ratio — if the person is getting shorter in the frame, they are collapsing

The ST-GCN captures complex movement patterns it learned from 3,847 training sequences. The 18 features capture what clinical experts know about fall biomechanics. Combining both — Late Fusion — gives better accuracy than either alone, because they are complementary. The graph model sees what the features miss, and the features see what the graph model misses."

---

---

# PART 3 — SOLUTION IMPLEMENTATION (LO3)

---

## 3.1 What technologies did you use and why?

**Simple English Answer (say this):**

"I will go through each technology and explain why I chose it.

**PyTorch** — I used PyTorch for the machine learning model. PyTorch is the industry standard for research-grade deep learning. It supports dynamic computation graphs, which makes it easier to debug and experiment during model development. The alternative is TensorFlow, but PyTorch is more widely used in academic research and has better support for graph neural networks.

**MediaPipe Pose** — I used MediaPipe for pose estimation, which means extracting the skeleton from the camera feed. MediaPipe runs on CPU, which means I do not need an expensive GPU on the edge device. It is optimised by Google for real-time performance on low-power hardware. I pinned the version to >=0.10,<0.11 because MediaPipe changes landmark indices between major versions, which would break the model.

**FastAPI** — I used FastAPI for the backend web framework. FastAPI is asynchronous, which means it can handle multiple WebSocket connections and REST requests at the same time without blocking. This is essential for real-time streaming. The alternative is Flask, but Flask is synchronous and would not handle concurrent WebSocket connections well.

**Supabase** — I used Supabase as the database and backend-as-a-service. Supabase is built on PostgreSQL, which gives us full SQL querying power. It also provides authentication and a REST API automatically. The alternative is Firebase, but Firebase uses a NoSQL document model which is less suited to relational data like rooms-patients-alerts.

**Cloudflare R2** — I used R2 for storing skeleton replay files. R2 is object storage compatible with Amazon S3 but has no egress fees, which makes it cost-effective for storing many small JSON files.

**Flutter** — I used Flutter for the mobile app. Flutter compiles to native iOS and Android from a single codebase, which saves development time. The alternative is React Native, but Flutter has better performance and a more consistent UI.

**React with TypeScript** — I used React for the web dashboard. TypeScript adds type safety, which reduces bugs in a real-time data-heavy interface."

---

## 3.2 What industry best practices did you follow?

**Simple English Answer (say this):**

"I followed several software engineering and machine learning best practices.

**Subject-disjoint data split** — In my training data, the people in the test set are completely different from the people in the training set. This is the correct way to validate a model. If the same person appears in both sets, the model could just be memorising that person's movements, not learning generalised fall patterns.

**MD5 checksum verification** — Every time the backend starts, it computes the MD5 hash of each model file and logs it. This means if a model file becomes corrupted or is accidentally replaced with a different version, it will be immediately visible in the startup log.

**Model card** — I created a model card document that describes the model's architecture, training data, known failure modes, limitations, and intended use. This is a standard practice in responsible AI deployment.

**Automated testing** — I have 46 automated tests covering the post-processor logic, all API endpoints, and edge cases. Tests run in under 2 minutes. If any change breaks the system, the tests immediately show which part failed.

**Environment variables for secrets** — Credentials like the Supabase key and API key are stored in a .env file that is not committed to git. The .env.example file shows the structure without real values.

**API key authentication** — All endpoints except health check require an API key. This prevents unauthorised access even on a local network.

**Graceful degradation** — If Supabase is unavailable, the live monitoring continues. If the camera disconnects, there is an automatic reconnect loop. The system is designed to keep running even when external dependencies fail."

---

## 3.3 Professional, legal, social, security and ethical issues — what did you address?

**Simple English Answer (say this):**

"I identified and addressed several important issues.

**Privacy** — The most sensitive issue in a patient monitoring system is privacy. SENTRY never transmits raw video over the network. The web dashboard shows only a skeleton — 14 dots and lines representing joint positions. The patient's actual appearance is never sent anywhere. The video stream endpoint (which is optional) now requires a security token before it will serve frames.

**Security** — All REST API endpoints require an API key via the X-API-Key header. The video stream endpoint requires a token query parameter. Credentials are stored in environment variables, never hardcoded. The dangerous clear-demo endpoint requires an explicit confirmation parameter to prevent accidental data deletion.

**Data minimisation** — We store the minimum data needed: skeleton frames, risk scores, alert timestamps, and patient codes. We do not store patient names, photos, or medical records — those are in the hospital's own system.

**Ethical use** — SENTRY is explicitly a research prototype. It is not intended for unsupervised clinical deployment. Any clinical use would require ethics board approval, patient consent, and regulatory review. These are documented as deployment prerequisites.

**Legal** — Under Sri Lanka's Personal Data Protection Act and international GDPR principles, skeleton data linked to a patient code is still personal data. Data minimisation is satisfied. Role-based access ensures only authorised caregivers and supervisors can view monitoring data. Full compliance would require a Data Protection Impact Assessment before clinical deployment."

---

## 3.4 Non-functional requirements — what did you address?

**Simple English Answer (say this):**

"Non-functional requirements are things that describe how the system works, not what it does.

**Performance / Latency** — Inference runs approximately 10 times per second. From when a fall begins to when the caregiver's phone receives the alert is 3 to 4 seconds. This 3-second dwell time is intentional — it prevents false alarms from brief sudden movements.

**Reliability** — If the camera disconnects, the system tries to reconnect automatically after 30 consecutive failed reads. If Supabase is unavailable, the inference loop continues — only alert history storage is affected. The system never crashes from a DB failure.

**Scalability** — The architecture supports multiple rooms. Each room can have its own inference engine instance. The database schema has room_id foreign keys throughout, designed for multi-room use.

**Usability** — The web dashboard shows a live skeleton, risk level, posture label, and alert history. A warning banner appears when pose quality is DEGRADED. Caregivers can export alert history as a CSV file. The mobile app has pull-to-refresh and sound toggle.

**Security** — Covered above — API key, token for video, environment variables.

**Maintainability** — 46 automated tests, model card, requirements pinned in requirements.txt, environment variables for all configuration. A new developer can set up the system by following the .env.example and running pip install -r requirements.txt."

---

---

# PART 4 — EFFECTIVE COMMUNICATION (LO4)

---

## 4.1 How to open the viva — what to say first

**Say this at the start if the examiner asks you to introduce your work:**

"My research is called SENTRY. The full name is Edge-Enabled Skeletal Movement Analysis System for Real-Time Patient-Observable Fall Risk Detection and Prediction.

The problem I am solving is patient falls in hospitals. Falls are the most common preventable patient safety incident in healthcare. Existing solutions either require uncomfortable wearable devices that patients remove, or simple motion sensors that can only detect a fall after the person has already hit the ground.

SENTRY uses a standard USB webcam to extract a patient's skeleton in real time, analyses the skeleton's movement using a graph neural network combined with 18 clinical biomechanical features, and sends an alert to the caregiver's phone or web dashboard when the risk of falling is rising — before the fall happens.

Everything runs on the edge device in the room. No patient video ever leaves the device. Only the skeleton — 14 dots and lines — is transmitted for display."

---

## 4.2 How to explain the pipeline simply in 60 seconds

**Say this when asked to explain how the system works:**

"The system works in seven steps.

Step one: A USB webcam captures video at 30 frames per second.

Step two: MediaPipe Pose extracts the patient's skeleton — 14 key joints like shoulders, hips, knees, and ankles.

Step three: We run two analyses in parallel. First, the ST-GCN graph neural network analyses 30 frames at a time to understand spatiotemporal movement patterns. Second, we compute 18 handcrafted clinical features like torso lean angle, hip descent velocity, and knee collapse ratio.

Step four: Late Fusion combines both outputs into a single fall risk score between 0 and 1.

Step five: The post-processor smooths the score using exponential moving average, applies dual-gate thresholds, and only fires a HIGH alert when the score has been elevated for 2.5 seconds continuously.

Step six: The context engine checks the patient's posture and which zone of the room they are in. If they are sitting, high risk is capped at moderate to prevent false alarms.

Step seven: The alert is pushed via WebSocket to the caregiver's mobile app and web dashboard within milliseconds."

---

---

# PART 5 — COMMERCIALISATION AND ENTREPRENEURSHIP (LO5)

---

## 5.1 What is the business potential of SENTRY? (Full 2-minute pitch)

**Say this for the commercialisation question — practise this out loud:**

"SENTRY has a clear and realistic path to commercialisation.

**The market opportunity:**
The global patient monitoring market is valued at approximately USD 22 billion in 2024 and is growing at 8% per year. This growth is driven by an aging global population and increasing pressure on healthcare systems to reduce preventable incidents. In Sri Lanka, the healthcare sector is growing rapidly with private hospital expansion. Hospital-acquired falls are a major financial and reputational liability for hospitals — each fall incident costs significant nursing time, potential litigation, and longer patient stays.

**The product:**
SENTRY is a software system that runs on commodity hardware — a standard edge computer and a USB webcam. The hospital does not need to buy specialised sensors or rewire rooms. The setup cost per room is low. The software is the value.

**The business model:**
The most appropriate model is Software-as-a-Service per room per month. A private hospital with 50 high-dependency rooms would pay a monthly subscription. The hospital avoids the cost of one prevented fall incident — which includes nursing overtime, potential insurance claims, and extended patient stay — and that saving justifies the subscription cost many times over.

**The competitive advantage:**
SENTRY's key differentiator is privacy. Healthcare is moving toward stricter patient data regulations globally. SENTRY stores no video, transmits no video, and processes everything on-device. For hospital administrators worried about data compliance, SENTRY is the only option that is compliant by design.

**The go-to-market path:**
The first step is a pilot deployment in one private hospital ward in Sri Lanka. This generates real-world clinical data and caregiver feedback. After validation, the product can scale to multi-hospital contracts in Sri Lanka, then regionally to South and Southeast Asia where private healthcare is growing fastest. The technology can also be licensed as an OEM module to camera hardware vendors who want to add intelligent patient monitoring to their products.

**The longer-term vision:**
The same skeleton-based edge analysis pipeline can be applied beyond fall detection — to physiotherapy progress monitoring, dementia patient wandering detection, and post-operative mobility assessment. The architecture is the platform; fall detection is the first application."

---

## 5.2 Short version if examiner asks in 30 seconds

**Say this for a quick commercialisation question:**

"The business model is SaaS — a monthly subscription per hospital room. The target market is private hospitals and aged care facilities globally. Our competitive advantage is privacy by design — no video ever leaves the room, which is a major selling point as healthcare data regulations tighten. The first step to commercialisation is a clinical pilot in a single ward, which generates validation data for scaling to regional hospital chains."

---

---

# PART 6 — TRICKY QUESTIONS WITH SIMPLE ANSWERS

---

## Q: Your system takes 3 seconds to alert. A patient can be injured in less than 3 seconds.

**Answer:**
"A fall has two phases. The first phase is loss of balance — the person starts to lean, their centre of mass shifts, their knees start to bend. This phase takes 300 to 500 milliseconds. SENTRY detects the rising risk score during this first phase.

The second phase is the actual impact — hitting the ground. This happens at the end.

Our 3-second dwell requirement means the system needs to see elevated risk for 2.5 seconds before firing the HIGH alert. This is designed to prevent false alarms — a single sudden movement should not alarm the whole ward.

The caregiver who receives the alert cannot arrive in 3 seconds anyway — they have to walk from another room. The goal is to alert them that the risk is rising so they arrive before or immediately after the incident, not to stop the fall mid-air.

And we can reduce the dwell time — the sustained counter of 25 readings is a configurable parameter."

---

## Q: How do you know your model is not just memorising your training data?

**Answer:**
"We used a subject-disjoint split. This means the people in the test set are completely different people from those in the training set. The model has never seen them before during training.

If the model was memorising, it would fail on new people and the AUC would be low. Our subject-disjoint AUC is 0.9836, which is strong evidence the model has learned generalised fall patterns, not specific people's movements.

Additionally, our webcam AUC of 0.8527 is lower than the main AUC — this is an honest result that shows domain shift when going from studio data to a real webcam. If we were inflating numbers, we would not report this gap."

---

## Q: What if two patients are in the same room?

**Answer:**
"MediaPipe Pose detects one person — the closest person to the camera. If two people are in frame, the system analyses the closest one.

This is acknowledged as a limitation — the system is designed for single-occupancy monitoring rooms, which is the standard use case for high-dependency patients.

Multi-person tracking would require a different pose estimation pipeline and is listed as future work. For the current prototype, single-occupancy rooms are the target deployment environment."

---

## Q: What if the camera angle is wrong?

**Answer:**
"We documented this as failure mode V3 — camera angle greater than 45 degrees from the sagittal plane causes hip and ankle features to be unreliable.

The system is designed to be mounted with a clear overhead or angled side view. In the demo setup, the camera is mounted at the correct angle for the protocol we used.

For clinical deployment, camera placement guidelines would be part of the installation protocol — the same way any CCTV or clinical camera has mounting specifications."

---

## Q: Is this a medical device?

**Answer:**
"In most regulatory frameworks, a system that generates clinical alerts used in patient care decisions would be classified as a medical device — in Sri Lanka under the National Medicines Regulatory Authority, and internationally under FDA or EU MDR.

SENTRY is explicitly a research prototype. It is not intended for unsupervised clinical use without regulatory clearance. The thesis clearly states that clinical validation, ethics approval, and regulatory review are prerequisites before any deployment in a real healthcare setting.

The research contribution is demonstrating the feasibility and accuracy of the architecture — not making a medical claim."

---

## Q: Why is your AUC 0.9836? That seems too high.

**Answer:**
"I understand the scepticism. Let me explain why it is valid.

First, AUC measures how well the model ranks fall sequences above non-fall sequences. A 0.9836 AUC means that 98% of the time, the model correctly assigns a higher score to a fall sequence than to a non-fall sequence.

Second, the test set is subject-disjoint — different people from the training set. This is the strongest generalisation test.

Third, NTU RGB+D is a large, diverse dataset — 56 activity classes, hundreds of subjects, multiple camera angles. The diversity makes overfitting harder.

Fourth, the honest evidence is the webcam AUC of 0.8527 — much lower because of the domain shift from studio to webcam. If we were inflating numbers, we would not show this drop."

---

## Q: Why did you not just use a simple rule — if person falls to ground, alert?

**Answer:**
"A simple height-threshold rule has two problems.

First, it only detects the fall after the person is already on the ground — that is fall detection, not fall risk detection. By then the injury has already happened.

Second, many normal activities look the same. A person bending down to pick something up, a child playing on the floor, a person sitting cross-legged — all of these would trigger a height threshold. The false alarm rate would be unacceptably high, and caregivers would start ignoring alerts — which is actually more dangerous than no alerts at all.

ST-GCN with Late Fusion understands the temporal pattern — how the movement evolves over 30 frames — and the spatial relationships between joints. It can tell the difference between controlled bending and uncontrolled collapse."

---

## Q: What was the hardest technical challenge you faced?

**Answer:**
"The hardest challenge was the false alarm problem with the SITTING posture.

Early versions of the system would fire HIGH alerts when a patient moved their arms quickly while seated — for example, reaching for a cup or a TV remote. The model correctly saw rapid joint movement and high angular velocity, but this was not a fall risk.

The solution was the posture-aware post-processor. When the posture classifier detects the patient is sitting, HIGH risk is capped at MODERATE. But I had to be very careful — if the patient starts to stand up from the chair, the posture becomes TRANSITION, and I needed the system to become MORE sensitive at that moment, not less.

I proved this works with three automated tests in TestSittingTransitionSafety. These tests simulate the exact scenario and verify that fall alerts fire correctly during sit-to-stand transitions even though sitting is normally capped."

---

## Q: What would you do differently if you started again?

**Answer:**
"I would collect more webcam data earlier in the project. The 93 clips for webcam fine-tuning is a small dataset, and the webcam AUC of 0.8527 reflects that. With 500 clips collected over more diverse lighting, clothing, and patient scenarios, the webcam AUC would be significantly higher and more clinically meaningful.

I would also implement HTTPS from the beginning. For a prototype running on a closed network it is not critical, but having it from the start would make the clinical pilot transition smoother.

And I would have designed the zone modifier system differently — either not computing zone modifiers at all in the prototype, or investing more time tuning the thresholds so they could be applied to the score rather than being display-only."

---

---

# PART 7 — NUMBERS TO MEMORISE

Read these before you sleep tonight.

| What | Number | Context |
|---|---|---|
| Total training sequences | 3,847 | NTU 3,777 + UR 70 + Webcam 93 |
| Subject-disjoint AUC | 0.9836 | Main result |
| Webcam AUC | 0.8527 | Domain-adapted result |
| Decision threshold | 0.32 | Maximises F1 on webcam |
| EMA alpha | 0.25 | Smoothing factor |
| τ_low | 0.55 | NORMAL → MODERATE |
| τ_high | 0.72 | MODERATE → HIGH |
| Alert cooldown | 20 seconds | No duplicate alerts |
| Sustained counter | 25 readings | ~2.5 seconds |
| Inference rate | ~10/second | INFER_EVERY_N=3 at 30fps |
| Joints | 14 | From MediaPipe 33 |
| Features | 18 | F1 to F18 |
| ST-GCN output | 128-D | Graph embedding |
| Fusion input | 146-D | 128 + 18 |
| Total tests | 46 | All passing |
| MediaPipe version | >=0.10,<0.11 | Pinned |
| Backend port | 8000 | localhost |
| Alert latency | 3-4 seconds | Fall onset to phone notification |

---

*SENTRY Viva Answers Document — IT22057488 — SLIIT 2024/25*
*Read every section out loud at least once before the viva.*
