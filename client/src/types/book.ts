import type { PointType } from '@/types/point';

export type BookAvailability = {
  pointId: string;
  pointName: string;
  city: string | null;
  type: PointType;
  copies: number;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type BookSummary = {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  year?: number | null;
  genre?: string | null;
  publisher?: string | null;
  description?: string | null;
  coverPath?: string | null;
  availability: BookAvailability[];
};
