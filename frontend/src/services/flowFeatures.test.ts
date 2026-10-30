import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasValidFlowFeatures, CIC_IDS2017_FEATURE_MARKERS } from './flowFeatures.ts';

describe('flowFeatures validation logic', () => {
  it('rejects null or undefined inputs', () => {
    assert.equal(hasValidFlowFeatures(null), false);
    assert.equal(hasValidFlowFeatures(undefined), false);
  });

  it('rejects empty feature objects', () => {
    assert.equal(hasValidFlowFeatures({}), false);
  });

  it('rejects header-only telemetry without flow statistical markers', () => {
    const headerOnly = {
      source_ip: '192.168.1.100',
      destination_ip: '10.0.0.1',
      source_port: 443,
      destination_port: 80,
      protocol: 'TCP',
    };
    assert.equal(hasValidFlowFeatures(headerOnly), false);
  });

  it('rejects payloads with fewer than 3 recognizable markers', () => {
    const insufficientMarkers = {
      'Protocol': 6,
      'Flow Duration': 1000,
      'arbitrary_key': 123,
    };
    assert.equal(hasValidFlowFeatures(insufficientMarkers), false);
  });

  it('accepts valid CIC-IDS2017 flow feature vectors', () => {
    const validVector = {
      'Protocol': 6,
      'Flow Duration': 120000,
      'Total Fwd Packets': 10,
      'Total Backward Packets': 8,
      'Fwd Packet Length Mean': 450.5,
      'Flow IAT Mean': 2300.0,
      'Flow Bytes/s': 15000.0,
    };
    assert.equal(hasValidFlowFeatures(validVector), true);
  });

  it('exports expected CIC-IDS2017 feature marker list', () => {
    assert.ok(CIC_IDS2017_FEATURE_MARKERS.includes('Flow Duration'));
    assert.ok(CIC_IDS2017_FEATURE_MARKERS.includes('Total Fwd Packets'));
    assert.ok(CIC_IDS2017_FEATURE_MARKERS.includes('Flow IAT Mean'));
  });
});
