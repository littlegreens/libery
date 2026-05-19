import LiberyIcon from '@/components/LiberyIcon';
import { icons } from '@/lib/assets';

type Props = {
  className?: string;
};

export default function BrandLogo({ className = '' }: Props) {
  return (
    <LiberyIcon
      src={icons.logo}
      alt="Libery — cerca, scambia, leggi"
      className={`home-logo ${className}`.trim()}
    />
  );
}
