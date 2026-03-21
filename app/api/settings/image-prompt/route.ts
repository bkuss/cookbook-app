import { getSetting, setSetting } from '@/lib/db/queries/settings';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';

const DEFAULT_TEMPLATE = 'Professional food photography of "{title}" dish with {ingredients}, appetizing, well-plated on a wooden surface, some of the ingredients visible behind and around the dish, natural lighting, shallow depth of field, isometric view';

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const template = await getSetting('image_prompt_template');
    return NextResponse.json({ template: template || DEFAULT_TEMPLATE });
  } catch (error) {
    console.error('Error fetching image prompt template:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { template } = await req.json();

    if (typeof template !== 'string' || template.trim().length === 0) {
      return NextResponse.json({ error: 'Template darf nicht leer sein' }, { status: 400 });
    }

    if (!template.includes('{title}')) {
      return NextResponse.json({ error: 'Template muss {title} enthalten' }, { status: 400 });
    }

    await setSetting('image_prompt_template', template.trim());
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting image prompt template:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
