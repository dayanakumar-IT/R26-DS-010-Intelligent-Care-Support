# Test Evaluation Report

## ST-GCN only
```
              precision    recall  f1-score   support

      NORMAL     0.9904    0.9559    0.9728       431
        FALL     0.8827    0.9728    0.9256       147

    accuracy                         0.9602       578
   macro avg     0.9366    0.9644    0.9492       578
weighted avg     0.9630    0.9602    0.9608       578

confusion matrix [rows=true, cols=pred]:
[[412  19]
 [  4 143]]
ROC-AUC: 0.9886   PR-AUC: 0.9674
```

## Feature-only classifier
```
              precision    recall  f1-score   support

      NORMAL     0.9741    0.9582    0.9661       431
        FALL     0.8831    0.9252    0.9037       147

    accuracy                         0.9498       578
   macro avg     0.9286    0.9417    0.9349       578
weighted avg     0.9509    0.9498    0.9502       578

confusion matrix [rows=true, cols=pred]:
[[413  18]
 [ 11 136]]
ROC-AUC: 0.9865   PR-AUC: 0.9688
```

## Fusion (ST-GCN + features)
```
              precision    recall  f1-score   support

      NORMAL     0.9839    0.9930    0.9885       431
        FALL     0.9790    0.9524    0.9655       147

    accuracy                         0.9827       578
   macro avg     0.9815    0.9727    0.9770       578
weighted avg     0.9827    0.9827    0.9826       578

confusion matrix [rows=true, cols=pred]:
[[428   3]
 [  7 140]]
ROC-AUC: 0.9926   PR-AUC: 0.9922
```
