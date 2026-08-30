# Webcam Held-Out Test Evaluation Report (Model C)

**Dataset**: In-house webcam clips — Hikvision DS-U02, 30 FPS, 1280×720
**Split**: Subject-disjoint — subject2 held out (58 clips: 15 fall, 43 normal)
**Models**: Fine-tuned on subject1 webcam clips (Model C)
**Inference latency**: 4.51 ms per 90-frame window (CPU: cpu)

## ST-GCN only (webcam fine-tuned)
```
precision    recall  f1-score   support

      NORMAL     0.8000    0.3721    0.5079        43
        FALL     0.2895    0.7333    0.4151        15

    accuracy                         0.4655        58
   macro avg     0.5447    0.5527    0.4615        58
weighted avg     0.6680    0.4655    0.4839        58

confusion matrix [rows=true, cols=pred]:
[[16 27]
 [ 4 11]]
ROC-AUC: 0.6016   PR-AUC: 0.3954
```

## Feature-only classifier
```
precision    recall  f1-score   support

      NORMAL     0.7391    0.3953    0.5152        43
        FALL     0.2571    0.6000    0.3600        15

    accuracy                         0.4483        58
   macro avg     0.4981    0.4977    0.4376        58
weighted avg     0.6145    0.4483    0.4750        58

confusion matrix [rows=true, cols=pred]:
[[17 26]
 [ 6  9]]
ROC-AUC: 0.4605   PR-AUC: 0.2571
```

## Fusion — ST-GCN + Features (webcam fine-tuned)
```
precision    recall  f1-score   support

      NORMAL     0.9318    0.9535    0.9425        43
        FALL     0.8571    0.8000    0.8276        15

    accuracy                         0.9138        58
   macro avg     0.8945    0.8767    0.8851        58
weighted avg     0.9125    0.9138    0.9128        58

confusion matrix [rows=true, cols=pred]:
[[41  2]
 [ 3 12]]
ROC-AUC: 0.8527   PR-AUC: 0.8614
Decision threshold (val-optimal): 0.320
```

## Summary

| Model | Accuracy | Macro-F1 | Fall Recall | Fall Precision | Normal FP Rate | ROC-AUC |
|---|---|---|---|---|---|---|
| ST-GCN (fine-tuned) | 0.4655 | 0.4615 | 0.7333 | 0.2895 | 0.6279 | 0.6016 |
| Feature-only        | 0.4483 | 0.4376 | 0.6000 | 0.2571 | 0.6047 | 0.4605 |
| Fusion (fine-tuned) | 0.9138 | 0.8851 | 0.8000 | 0.8571 | 0.0465 | 0.8527 |