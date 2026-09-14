import { head } from '@vercel/blob';
import { NextResponse } from 'next/server';

// Proxy for private Vercel Blob URLs
// Private store URLs like https://xxx.private.blob.vercel-storage.com/... cannot be
// directly rendered in <img> without a signed downloadUrl. This route fetches a
// signed URL via `head` and redirects, allowing <img src="/api/blob?url=..."> to work.
// For public stores, the Blob URL can be used directly, but this proxy also works.

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const blobUrl = searchParams.get('url');

    if (!blobUrl) {
      return NextResponse.json({ message: 'Missing url parameter' }, { status: 400 });
    }

    // Only allow Vercel Blob URLs to prevent open redirect / SSRF
    if (!blobUrl.includes('blob.vercel-storage.com')) {
      return NextResponse.json({ message: 'Invalid blob URL' }, { status: 400 });
    }

    const blob = await head(blobUrl);

    // For private blobs, downloadUrl is a signed, time-limited URL that can be rendered
    // For public blobs, downloadUrl === url, redirect still works
    const targetUrl = (blob as any).downloadUrl || blob.url;

    // Redirect to the actual blob content (Vercel handles caching)
    return NextResponse.redirect(targetUrl, 307);
  } catch (err: any) {
    console.error('[Blob Proxy] failed:', err);
    return NextResponse.json({ message: err?.message || 'Failed to fetch blob' }, { status: 404 });
  }
}
