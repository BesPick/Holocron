import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { inArray } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { uploads } from '@/server/db/schema';
import type { Id, StorageImage } from '@/types/db';

export const uploadsDir = path.resolve(
  process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'public', 'uploads'),
);
fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
]);

function isAllowedImage(file: File) {
  const type = file.type?.toLowerCase();
  if (type && ALLOWED_IMAGE_TYPES.has(type)) return true;
  const ext = path.extname(file.name || '').toLowerCase();
  return ext ? ALLOWED_IMAGE_EXTENSIONS.has(ext) : false;
}

function getExtension(file: File) {
  const nameExt = path.extname(file.name).toLowerCase();
  if (nameExt) return nameExt;
  if (file.type.startsWith('image/')) {
    const subtype = file.type.split('/')[1];
    if (subtype === 'jpeg') return '.jpg';
    return `.${subtype}`;
  }
  return '.bin';
}

export async function saveUpload(file: File) {
  if (!isAllowedImage(file)) {
    throw new Error('Unsupported image format. Use JPG, PNG, GIF, or WEBP.');
  }
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = getExtension(file);
  const id = `${crypto.randomUUID()}${ext}`;
  const target = path.join(uploadsDir, id);
  await fs.promises.writeFile(target, buffer);
  await db.insert(uploads).values({
    id,
    filename: file.name || id,
    createdAt: Date.now(),
  });
  return { id: id as Id<'_storage'>, url: `/uploads/${id}` };
}

export async function getImageUrls(
  ids: Id<'_storage'>[],
): Promise<StorageImage[]> {
  const urls: StorageImage[] = [];
  for (const id of ids) {
    const filePath = path.join(uploadsDir, id);
    if (fs.existsSync(filePath)) {
      urls.push({ id, url: `/uploads/${id}` });
    }
  }
  return urls;
}

export async function deleteUploads(ids: Id<'_storage'>[]) {
  if (!ids || ids.length === 0) return;
  await db.delete(uploads).where(inArray(uploads.id, ids as string[]));
  await Promise.all(
    ids.map(async (id) => {
      const filePath = path.join(uploadsDir, id);
      try {
        await fs.promises.unlink(filePath);
      } catch {
        // ignore missing files
      }
    }),
  );
}
