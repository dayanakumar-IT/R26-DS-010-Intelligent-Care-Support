# Test Evaluation Report

## ST-GCN only
```
              precision    recall  f1-score   support

      NORMAL     0.9444    0.1183    0.2103       431
        FALL     0.2748    0.9796    0.4292       147

    accuracy                         0.3374       578
   macro avg     0.6096    0.5490    0.3198       578
weighted avg     0.7741    0.3374    0.2660       578

confusion matrix [rows=true, cols=pred]:
[[ 51 380]
 [  3 144]]
ROC-AUC: 0.9581   PR-AUC: 0.9517
```

## Fusion (ST-GCN + features)
```
              precision    recall  f1-score   support

      NORMAL     0.8000    0.0093    0.0183       431
        FALL     0.2548    0.9932    0.4056       147

    accuracy                         0.2595       578
   macro avg     0.5274    0.5012    0.2120       578
weighted avg     0.6613    0.2595    0.1168       578

confusion matrix [rows=true, cols=pred]:
[[  4 427]
 [  1 146]]
ROC-AUC: 0.6967   PR-AUC: 0.5222
```
