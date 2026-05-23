import { createComponent } from '@lit/react';
import React from 'react';
import {
  LiberyPointTypeBadge,
  type LiberyPointTypeBadgeSize,
  type LiberyPointTypeBadgeType,
} from '@/web-components/libery-point-type-badge';
import type { PointType } from '@/types/point';

const LiberyPointTypeBadgeEl = createComponent({
  react: React,
  tagName: 'libery-point-type-badge',
  elementClass: LiberyPointTypeBadge,
}) as any;

/** Badge tipo punto — wrapper React del web component `libery-point-type-badge`. */
export default function PointTypeBadge({
  type,
  size = 'medium',
  className,
}: {
  type: PointType;
  size?: LiberyPointTypeBadgeSize;
  className?: string;
}) {
  return (
    <LiberyPointTypeBadgeEl
      pointType={type as LiberyPointTypeBadgeType}
      size={size}
      className={className}
    />
  );
}

/** Crea un badge DOM per popup Leaflet (stesso web component). */
export function createPointTypeBadgeElement(
  type: PointType,
  size: LiberyPointTypeBadgeSize = 'small',
): LiberyPointTypeBadge {
  const el = document.createElement('libery-point-type-badge');
  el.pointType = type as LiberyPointTypeBadgeType;
  el.size = size;
  return el;
}
