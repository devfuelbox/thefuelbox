import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ message: 'Only image files are allowed' }, { status: 400 });
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ message: 'File too large. Max 5MB allowed' }, { status: 400 });
    }

    // Sanitize filename and make unique
    const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(originalName) || '.jpg';
    const base = path.basename(originalName, ext).slice(0, 50) || 'image';
    const filename = `${Date.now()}-${base}${ext}`;

    // Use Vercel Blob for persistent storage (works on Vercel, local if token set)
    // Falls back to local filesystem for local dev without BLOB_READ_WRITE_TOKEN
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    if (blobToken) {
      try {
        const blob = await put(`fuelbox-menu/${filename}`, file, {
          access: 'public',
          contentType: file.type,
          token: blobToken,
        });
        // Return Blob public URL – saved directly to image_url column
        return NextResponse.json({ url: blob.url }, { status: 201 });
      } catch (blobErr: any) {
        console.error('[Upload API] Vercel Blob failed:', blobErr);
        // If Blob fails in production, surface error (no fs fallback on Vercel)
        if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
          return NextResponse.json(
            { message: blobErr?.message || 'Failed to upload to Vercel Blob. Check BLOB_READ_WRITE_TOKEN.' },
            { status: 500 }
          );
        }
        // For local dev, fall through to filesystem fallback below
        console.warn('[Upload API] Falling back to local filesystem for dev');
      }
    }

    // Local filesystem fallback – for development without BLOB_READ_WRITE_TOKEN
    // Vercel production filesystem is read-only (/var/task) except /tmp, so this will fail on Vercel without token
    try {
      const uploadDir = path.join(process.cwd(), 'public', 'images', 'uploads');
      await mkdir(uploadDir, { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      const filepath = path.join(uploadDir, filename);
      await writeFile(filepath, buffer);

      // Mirror to legacy path for backward compat
      try {
        const legacyDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(legacyDir, { recursive: true });
        const legacyPath = path.join(legacyDir, filename);
        await writeFile(legacyPath, buffer);
      } catch {
        // ignore
      }

      const url = `/images/uploads/${filename}`;
      return NextResponse.json({ url }, { status: 201 });
    } catch (fsErr: any) {
      // This is the original Vercel error: ENOENT mkdir '/var/task/public/images'
      console.error('[Upload API] filesystem fallback failed:', fsErr);
      if (!blobToken) {
        return NextResponse.json(
          {
            message:
              'BLOB_READ_WRITE_TOKEN not set and filesystem is read-only on Vercel. Add BLOB_READ_WRITE_TOKEN to Vercel Environment Variables.',
          },
          { status: 500 }
        );
      }
      throw fsErr;
    }
  } catch (err: any) {
    console.error('[Upload API] failed:', err);
    // Avoid leaking ENOENT path details to client, but log server side
    if (err?.code === 'ENOENT') {
      return NextResponse.json(
        {
          message:
            'Upload failed: filesystem is read-only on Vercel. Please set BLOB_READ_WRITE_TOKEN and use Vercel Blob.',
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ message: err?.message || 'Failed to upload image' }, { status: 500 });
  }
}
