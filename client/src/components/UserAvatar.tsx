import { useEffect, useState } from 'react';
import LiberyNumChip from '@/components/LiberyNumChip';
import type { AuthUser } from '@/stores/authStore';

function initials(user: AuthUser): string {
  const name = user.displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

type Props = {
  user: AuthUser;
  id?: string;
  onClick?: () => void;
  className?: string;
  /** Badge slot liberi (es. «3» o «9+») in basso a destra. */
  slotBadge?: string | null;
};

export default function UserAvatar({ user, id, onClick, className = '', slotBadge }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const avatarSrc = user.avatarUrl ?? null;

  useEffect(() => {
    setImgFailed(false);
  }, [avatarSrc]);

  const showImg = avatarSrc && !imgFailed;
  const badge = slotBadge?.trim();
  const badgeEmpty = badge === '0';

  return (
    <button
      type="button"
      id={id}
      className={`user-avatar ${badge ? 'user-avatar--badged' : ''} ${className}`.trim()}
      onClick={onClick}
      aria-label={`Profilo: ${user.displayName ?? user.email}${badge ? `, ${badge} libri disponibili` : ''}`}
      title={
        badge
          ? `${user.displayName ?? user.email} · ${badge} da prendere`
          : (user.displayName ?? user.email)
      }
    >
      {showImg ? (
        <img
          key={avatarSrc}
          src={avatarSrc}
          alt=""
          className="user-avatar-img"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span>{initials(user)}</span>
      )}
      {badge ? (
        <LiberyNumChip
          value={badge}
          className={[
            'libery-num-chip--on-avatar',
            badgeEmpty ? 'libery-num-chip--muted' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden
        />
      ) : null}
    </button>
  );
}
