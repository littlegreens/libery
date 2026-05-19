import { useState } from 'react';
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
  onClick?: () => void;
  className?: string;
};

export default function UserAvatar({ user, onClick, className = '' }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = user.avatarUrl && !imgFailed;

  return (
    <button
      type="button"
      className={`user-avatar ${className}`.trim()}
      onClick={onClick}
      aria-label={`Profilo: ${user.displayName ?? user.email}`}
      title={user.displayName ?? user.email}
    >
      {showImg ? (
        <img
          src={user.avatarUrl!}
          alt=""
          className="user-avatar-img"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span>{initials(user)}</span>
      )}
    </button>
  );
}
