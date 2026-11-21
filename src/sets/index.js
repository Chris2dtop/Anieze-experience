import { buildParisAtelier } from './paris_atelier.js';
import { buildParisCourtyard } from './paris_courtyard.js';

export const SET_REGISTRY = {
  atelier: {
    id: 'atelier',
    label: 'Paris Atelier',
    build: buildParisAtelier
  },
  courtyard: {
    id: 'courtyard',
    label: 'Paris Courtyard',
    build: buildParisCourtyard
  }
};

export function resolveSet(setKey) {
  const key = String(setKey || 'atelier').toLowerCase();
  return SET_REGISTRY[key] || SET_REGISTRY.atelier;
}
