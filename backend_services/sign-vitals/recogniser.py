"""
recogniser.py
GLOSS component — the sign-recognition model (final, thesis-reported).

One file: gloss_assets/GLOSS_ensemble.keras. It already averages the
TCN and the SPOTER-style model internally, so there is no averaging
code here and neither of the two member models is ever loaded on its
own.

ClassTokenPooling below is copied VERBATIM from
gloss_assets/gloss_reference_pipeline.py (notebook 03, cell A1). If the
notebook's class ever changes, re-copy it — do not edit it here.
"""

import os

import tensorflow as tf

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# The fingerprinted product bundle (see gloss_assets/manifest.json) at
# the repo root. Every GLOSS model/scaler/threshold/reference file the
# app loads comes from here — nothing is read from models/ any more.
ASSETS_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "..", "gloss_assets"))

MODEL_FILENAME = "GLOSS_ensemble.keras"
MODEL_PATH = os.path.join(ASSETS_DIR, MODEL_FILENAME)


@tf.keras.utils.register_keras_serializable()
class ClassTokenPooling(tf.keras.layers.Layer):   # custom layer used by the SPOTER-style model
    def __init__(self, d_model, **kwargs):
        super().__init__(**kwargs)
        self.d_model = d_model

    def build(self, input_shape):
        self.class_token = self.add_weight(shape=(1, 1, self.d_model), initializer="random_normal",
                                           trainable=True, name="class_token")

    def call(self, x):
        token = tf.tile(self.class_token, [tf.shape(x)[0], 1, 1])
        return tf.concat([token, x], axis=1)


def load_ensemble(path: str = MODEL_PATH):
    """Loads GLOSS_ensemble.keras. Call ONCE at startup and reuse the
    returned model for every request."""
    return tf.keras.models.load_model(
        path, compile=False, custom_objects={"ClassTokenPooling": ClassTokenPooling}
    )


def predict_probs(model, x):
    """x: (1, 60, 441) standardized tensor. Returns the (59,) class
    probabilities. Direct call, not .predict() — same as the parity
    reference."""
    return model(x, training=False).numpy()[0]
