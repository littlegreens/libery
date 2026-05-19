export type PointType = 'biblioteca' | 'libreria' | 'corner_free';

export type MapPoint = {
  id: string;
  name: string;
  type: PointType;
  status: string;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  openingHours?: Record<string, string> | null;
  photoUrl?: string | null;
  setupCompleted: boolean;
};
