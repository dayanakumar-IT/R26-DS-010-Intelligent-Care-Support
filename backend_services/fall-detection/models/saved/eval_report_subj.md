# Test Evaluation Report

## ST-GCN only
```
              precision    recall  f1-score   support

      NORMAL     0.9741    0.9658    0.9700       234
        FALL     0.9000    0.9231    0.9114        78

    accuracy                         0.9551       312
   macro avg     0.9371    0.9444    0.9407       312
weighted avg     0.9556    0.9551    0.9553       312

confusion matrix [rows=true, cols=pred]:
[[226   8]
 [  6  72]]
ROC-AUC: 0.9780   PR-AUC: 0.9540
```

## Feature-only classifier
```
              precision    recall  f1-score   support

      NORMAL     0.9827    0.9701    0.9763       234
        FALL     0.9136    0.9487    0.9308        78

    accuracy                         0.9647       312
   macro avg     0.9481    0.9594    0.9536       312
weighted avg     0.9654    0.9647    0.9650       312

confusion matrix [rows=true, cols=pred]:
[[227   7]
 [  4  74]]
ROC-AUC: 0.9905   PR-AUC: 0.9778
```

## Fusion (ST-GCN + features)
```
              precision    recall  f1-score   support

      NORMAL     0.9747    0.9872    0.9809       234
        FALL     0.9600    0.9231    0.9412        78

    accuracy                         0.9712       312
   macro avg     0.9673    0.9551    0.9610       312
weighted avg     0.9710    0.9712    0.9710       312

confusion matrix [rows=true, cols=pred]:
[[231   3]
 [  6  72]]
ROC-AUC: 0.9836   PR-AUC: 0.9793
```
