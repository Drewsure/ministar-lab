import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/upload
// Teacher uploads an image or audio file for a custom activity.
// Files are stored as base64 in memory (for MVP) — in production, use Vercel Blob / S3.
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'image' or 'audio'
    const labelsJson = formData.get('labels') as string; // JSON string of label positions

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');
    if (!isImage && !isAudio) {
      return NextResponse.json({ error: 'File must be an image or audio' }, { status: 400 });
    }

    // Validate size (10MB max for MVP)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    // Convert to base64 data URL
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Parse labels if provided (for label-it game)
    let labels: any[] = [];
    if (labelsJson) {
      try {
        labels = JSON.parse(labelsJson);
      } catch {}
    }

    // For MVP: return the data URL directly (client stores in localStorage)
    // In production: upload to Vercel Blob / S3 and return a URL
    return NextResponse.json({
      success: true,
      dataUrl,
      type: isImage ? 'image' : 'audio',
      fileName: file.name,
      fileSize: file.size,
      labels,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
