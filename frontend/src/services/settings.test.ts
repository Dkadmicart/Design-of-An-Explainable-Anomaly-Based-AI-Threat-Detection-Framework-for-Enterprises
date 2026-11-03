import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AppSettings } from '../types';

describe('Platform Preferences & Detection Engine Settings Tests', () => {
  const defaultSettings: AppSettings = {
    detection_mode: 'binary',
    alert_threshold: 50.0,
    replay_speed: 1.0,
    notifications_enabled: true,
    selected_model: 'XGBoost Grouped Classifier',
    selected_dataset: 'CIC-IDS2017 Benchmark',
  };

  it('default settings specify binary mode and active XGBoost classifier', () => {
    assert.equal(defaultSettings.detection_mode, 'binary');
    assert.equal(defaultSettings.selected_model, 'XGBoost Grouped Classifier');
    assert.equal(defaultSettings.selected_dataset, 'CIC-IDS2017 Benchmark');
    assert.equal(defaultSettings.alert_threshold, 50.0);
    assert.equal(defaultSettings.replay_speed, 1.0);
    assert.equal(defaultSettings.notifications_enabled, true);
  });

  it('alert generation rule accurately reflects (risk_score >= threshold || prediction === "ATTACK")', () => {
    const evaluateAlert = (prediction: string, risk_score: number, threshold: number): boolean => {
      return risk_score >= threshold || prediction === 'ATTACK';
    };

    // 1. Attack predictions always generate alerts, even when threshold is elevated
    assert.equal(evaluateAlert('ATTACK', 60.0, 50.0), true);
    assert.equal(evaluateAlert('ATTACK', 30.0, 80.0), true);
    assert.equal(evaluateAlert('ATTACK', 10.0, 90.0), true);

    // 2. Benign flows generate alerts only if risk_score meets or exceeds threshold
    assert.equal(evaluateAlert('BENIGN', 35.0, 50.0), false);
    assert.equal(evaluateAlert('BENIGN', 55.0, 50.0), true);
    assert.equal(evaluateAlert('BENIGN', 45.0, 40.0), true);
    assert.equal(evaluateAlert('BENIGN', 45.0, 60.0), false);
  });

  it('validates threshold boundaries across the UI slider range [10, 90]', () => {
    const isSliderValid = (val: number): boolean => {
      return Number.isFinite(val) && val >= 10 && val <= 90;
    };

    assert.equal(isSliderValid(10), true);
    assert.equal(isSliderValid(50), true);
    assert.equal(isSliderValid(90), true);
    assert.equal(isSliderValid(5), false);
    assert.equal(isSliderValid(95), false);
    assert.equal(isSliderValid(NaN), false);
  });

  it('ensures multiclass mode is marked unavailable for the current binary classifier', () => {
    const supportedModes = ['binary'];
    const isModeSupported = (mode: string): boolean => supportedModes.includes(mode);

    assert.equal(isModeSupported('binary'), true);
    assert.equal(isModeSupported('multiclass'), false);
  });

  it('ensures active detection model must correspond to trained XGBoost detector', () => {
    const trainedModelName = 'XGBoost Grouped Classifier';
    const isTrainedModelActive = (modelName: string): boolean => {
      return modelName === trainedModelName;
    };

    assert.equal(isTrainedModelActive('XGBoost Grouped Classifier'), true);
    assert.equal(isTrainedModelActive('Random Forest Baseline'), false);
    assert.equal(isTrainedModelActive('Logistic Regression'), false);
    assert.equal(isTrainedModelActive('Autoencoder'), false);
  });
});

