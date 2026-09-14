import { NextResponse } from 'next/server';
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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize filename and make unique
    const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(originalName) || '.jpg';
    const base = path.basename(originalName, ext).slice(0, 50) || 'image';
    const filename = `${Date.now()}-${base}${ext}`;

    // Store under public/images/uploads so URL matches /images/uploads/* (as required by spec)
    const uploadDir = path.join(process.cwd(), 'public', 'images', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, buffer);

    // Also ensure legacy /uploads path works by mirroring file there (backward compat for old /uploads/* URLs)
    try {
      const legacyDir = path.join(process.cwd(), 'public', 'uploads');
      await mkdir(legacyDir, { recursive: true });
      const legacyPath = path.join(legacyDir, filename);
      await writeFile(legacyPath, buffer);
    } catch {
      // ignore mirror failure
    }

    const url = `/images/uploads/${filename}`;

    return NextResponse.json({ url }, { status: 201 });
  } catch (err) {
    console.error('[Upload API] failed:', err);
    return NextResponse.json({ message: 'Failed to upload image' }, { status: 500 });
  }
}
