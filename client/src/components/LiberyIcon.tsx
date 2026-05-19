type Props = {
  src: string;
  className?: string;
  width?: number;
  height?: number;
  alt?: string;
};

/** Asset statico da `public/icons/` (SVG o PNG). */
export default function LiberyIcon({ src, className, width, height, alt = '' }: Props) {
  return <img src={src} alt={alt} width={width} height={height} className={className} draggable={false} />;
}
