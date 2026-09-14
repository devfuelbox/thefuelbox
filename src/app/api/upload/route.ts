import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';

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
    const ext = file.name.includes('.') ? `.${file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '')}` : '.jpg';
    const base = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 50) || 'image';
    const filename = `${Date.now()}-${base}${ext || '.jpg'}`;

    // Upload to Vercel Blob - public store for menu images (direct <img> rendering)
    // Requires BLOB_READ_WRITE_TOKEN env var and store configured as PUBLIC in Vercel Dashboard
    const blob = await put(`fuelbox-menu/${filename}`, file, {
      access: 'public',
    });

    // Return Blob public URL - frontend saves this directly to image_url column
    return NextResponse.json({ url: blob.url }, { status: 201 });
  } catch (err: any) {
    console.error('[Upload API] Vercel Blob upload failed:', err);
    const message =
      err?.message?.includes('BLOB_READ_WRITE_TOKEN') || err?.message?.includes('token')
        ? 'BLOB_READ_WRITE_TOKEN is missing or invalid. Add it in Vercel Project > Settings > Environment Variables.'
        : err?.message || 'Failed to upload image';
    return NextResponse.json({ message }, { status: 500 });
  }
}
