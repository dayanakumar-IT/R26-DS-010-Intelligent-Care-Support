# Cross-Dataset Evaluation Report

Train: NTU only  |  Test: UR only (70 clips)

## ST-GCN only
```
              precision    recall  f1-score   support

      NORMAL     0.0000    0.0000    0.0000        40
        FALL     0.4286    1.0000    0.6000        30

    accuracy                         0.4286        70
   macro avg     0.2143    0.5000    0.3000        70
weighted avg     0.1837    0.4286    0.2571        70

confusion matrix:
[[ 0 40]
 [ 0 30]]
ROC-AUC: 0.5000   PR-AUC: 0.4286
```

## Feature-only classifier
```
              precision    recall  f1-score   support

      NORMAL     0.5085    0.7500    0.6061        40
        FALL     0.0909    0.0333    0.0488        30

    accuracy                         0.4429        70
   macro avg     0.2997    0.3917    0.3274        70
weighted avg     0.3295    0.4429    0.3672        70

confusion matrix:
[[30 10]
 [29  1]]
ROC-AUC: 0.1850   PR-AUC: 0.2925
```

## Fusion (ST-GCN + features)
```
              precision    recall  f1-score   support

      NORMAL     0.5000    0.4750    0.4872        40
        FALL     0.3438    0.3667    0.3548        30

    accuracy                         0.4286        70
   macro avg     0.4219    0.4208    0.4210        70
weighted avg     0.4330    0.4286    0.4305        70

confusion matrix:
[[19 21]
 [19 11]]
ROC-AUC: 0.4100   PR-AUC: 0.3674
```
