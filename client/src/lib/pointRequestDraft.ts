import type { PointType } from '@/types/point';

export type PointRequestDraft = {
  pointType: PointType;
  name: string;
  city: string;
  address: string;
  latitude: string;
  longitude: string;
  contactPhone: string;
};

export const emptyPointRequestDraft = (): PointRequestDraft => ({
  pointType: 'biblioteca',
  name: '',
  city: '',
  address: '',
  latitude: '',
  longitude: '',
  contactPhone: '',
});

export function validatePointRequestDraft(draft: PointRequestDraft): string | null {
  if (!draft.name.trim()) return 'Nome del luogo obbligatorio';
  const hasAddress = draft.address.trim().length > 0;
  const lat = Number.parseFloat(draft.latitude);
  const lng = Number.parseFloat(draft.longitude);
  const hasGps = Number.isFinite(lat) && Number.isFinite(lng);
  if (!hasAddress && !hasGps) {
    return 'Inserisci un indirizzo oppure usa il GPS per le coordinate';
  }
  return null;
}

export function pointRequestDraftToPayload(draft: PointRequestDraft) {
  const lat = Number.parseFloat(draft.latitude);
  const lng = Number.parseFloat(draft.longitude);
  const hasGps = Number.isFinite(lat) && Number.isFinite(lng);
  return {
    pointType: draft.pointType,
    name: draft.name.trim(),
    city: draft.city.trim() || undefined,
    address: draft.address.trim() || undefined,
    latitude: hasGps ? lat : undefined,
    longitude: hasGps ? lng : undefined,
    contactPhone: draft.contactPhone.trim() || undefined,
  };
}
