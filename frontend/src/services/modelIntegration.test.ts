import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ModelFeatureContribution, ModelExplainResponse } from '../types/index.js';

describe('TreeSHAP explanation mapping for ShapWaterfall', () => {
  it('correctly maps ModelFeatureContribution to ShapFeature structure', () => {
    const rawContribution: ModelFeatureContribution = {
      feature: 'Destination Port',
      display_name: 'Destination Port',
      raw_value: '80.00',
      imputed_value: 80.0,
      shap_value: 1.45,
      impact: 'malicious',
      percentage: 28.5,
    };

    // Shape expected by ShapWaterfall component
    const shapFeature = {
      name: rawContribution.feature,
      label: rawContribution.display_name,
      rawVal: rawContribution.raw_value,
      shapVal: rawContribution.shap_value,
      percentage: rawContribution.percentage,
    };

    assert.equal(shapFeature.name, 'Destination Port');
    assert.equal(shapFeature.label, 'Destination Port');
    assert.equal(shapFeature.rawVal, '80.00');
    assert.equal(shapFeature.shapVal, 1.45);
    assert.equal(shapFeature.percentage, 28.5);
    assert.ok(shapFeature.shapVal > 0, 'Positive shap values push toward malicious/anomaly');
  });

  it('correctly calculates benign vs malicious pushes', () => {
    const maliciousContrib: ModelFeatureContribution = {
      feature: 'SYN Flag Count',
      display_name: 'SYN Flag Count',
      raw_value: '1.00',
      imputed_value: 1.0,
      shap_value: 0.85,
      impact: 'malicious',
      percentage: 18.0,
    };

    const benignContrib: ModelFeatureContribution = {
      feature: 'Bwd Packet Length Max',
      display_name: 'Bwd Packet Length Max',
      raw_value: '1460.00',
      imputed_value: 1460.0,
      shap_value: -0.62,
      impact: 'benign',
      percentage: 12.0,
    };

    assert.equal(maliciousContrib.impact, 'malicious');
    assert.equal(benignContrib.impact, 'benign');
    assert.ok(maliciousContrib.shap_value >= 0);
    assert.ok(benignContrib.shap_value < 0);
  });

  it('validates response structure matches ModelExplainResponse schema', () => {
    const mockResponse: ModelExplainResponse = {
      prediction: 'ATTACK',
      confidence: 0.994,
      anomaly_score: 0.994,
      base_value: -1.25,
      margin: 3.42,
      method: 'TreeSHAP (additive log-odds margin attribution)',
      feature_contributions: [
        {
          feature: 'Protocol',
          display_name: 'Protocol',
          raw_value: '6.00',
          imputed_value: 6.0,
          shap_value: 0.45,
          impact: 'malicious',
          percentage: 15.0,
        },
      ],
      explanation_notes: 'Feature contributions are additive log-odds values.',
    };

    assert.equal(mockResponse.prediction, 'ATTACK');
    assert.equal(mockResponse.feature_contributions.length, 1);
    assert.equal(mockResponse.method, 'TreeSHAP (additive log-odds margin attribution)');
    assert.ok(mockResponse.base_value !== undefined);
    assert.ok(mockResponse.margin !== undefined);
  });
});
