import fs from 'node:fs/promises';
import path from 'node:path';

const AVATAR_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export function getUploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? './uploads');
}

export function avatarDir(): string {
  return path.join(getUploadDir(), 'avatars');
}

export function extFromMime(mime: string): string {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  return '.jpg';
}

export function avatarPublicPath(userId: string, ext: string): string {
  return `/api/uploads/avatars/${userId}${ext}`;
}

export function avatarFilePath(userId: string, ext: string): string {
  return path.join(avatarDir(), `${userId}${ext}`);
}

/** Rimuove eventuali avatar precedenti con altre estensioni. */
export async function removeOtherAvatarFiles(userId: string, keepExt: string): Promise<void> {
  const dir = avatarDir();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return;
  }
  const prefix = userId;
  await Promise.all(
    entries
      .filter((name) => name.startsWith(prefix) && AVATAR_EXT.has(path.extname(name).toLowerCase()))
      .filter((name) => path.extname(name).toLowerCase() !== keepExt.toLowerCase())
      .map((name) => fs.unlink(path.join(dir, name)).catch(() => undefined)),
  );
}

export async function ensureAvatarDir(): Promise<string> {
  const dir = avatarDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
