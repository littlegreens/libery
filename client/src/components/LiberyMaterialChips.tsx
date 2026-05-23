import { MdChip } from '@/lib/material/md-react';
import type { PointType } from '@/types/point';
import { POINT_TYPE_LABELS } from '@/lib/mapIcons';

/** Chip **assist** non interattivo (etichetta / metadato), con sfondo leggibile. */
export function LiberyAssistLabelChip({ label }: { label: string }) {
  return <MdChip type="assist" label={label} disabled className="libery-assist-chip" />;
}

/** @deprecated Usa `PointTypeBadge` (`libery-point-type-badge`). */
export function LiberyPointTypeChip({ type }: { type: PointType }) {
  return <MdChip type="assist" label={POINT_TYPE_LABELS[type]} disabled />;
}
