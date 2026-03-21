import { getSetting, setSetting } from '@/lib/db/queries/settings';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const model = await getSetting('image_model');
    return NextResponse.json({ model: model || 'google/nano-banana' });
  } catch (error) {
    console.error('Error fetching image model setting:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { model } = await req.json();

    const validModels = [
      'google/nano-banana',
      'google/nano-banana-pro',
      'black-forest-labs/flux-schnell',
      'bytedance/seedream-4',
      'ideogram-ai/ideogram-v3-turbo',
      'openai/gpt-image-1.5'
    ];

    if (!validModels.includes(model)) {
      return NextResponse.json({ error: 'Invalid model' }, { status: 400 });
    }

    await setSetting('image_model', model);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting image model:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
