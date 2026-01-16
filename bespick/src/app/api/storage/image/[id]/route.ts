import fs from 'node:fs/promises';
import path from 'node:path';
import type { RouteContext } from 'next';
import { NextResponse } from 'next/server';
import { findUploadPath } from '@/server/services/storage';

const EXTENSION_TO_TYPE: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

function getContentType(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  return EXTENSION_TO_TYPE[ext] ?? 'application/octet-stream';
}

export async function GET(
  _request: Request,
  context: RouteContext<{ id: string }>,
) {
  const { id } = context.params;
  if (!id || path.basename(id) !== id) {
    return NextResponse.json({ error: 'Invalid image id.' }, { status: 400 });
  }
  const filePath = findUploadPath(id);
  if (!filePath) {
    return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
  }
  const file = await fs.readFile(filePath);
  return new NextResponse(file, {
    headers: {
      'Content-Type': getContentType(id),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
