import { NextResponse } from 'next/server';
import { requireIdentity } from '@/server/auth';
import { saveUpload } from '@/server/services/storage';
import { isTrustedOrigin } from '@/server/security/csrf';

export async function POST(request: Request) {
  try {
    await requireIdentity();
    if (!isTrustedOrigin(request)) {
      return NextResponse.json(
        { error: 'Invalid origin.' },
        { status: 403 },
      );
    }
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'File is required.' },
        { status: 400 },
      );
    }
    const { id, url } = await saveUpload(file);
    return NextResponse.json({ storageId: id, url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to upload file.';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
