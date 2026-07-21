import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';

export async function GET() {
  try {
    const { MenuItem } = await getDbModels();
    const dbItems = await (MenuItem as any).findAll({
      where: { is_available: true },
      order: [['id', 'ASC']],
    });
    return NextResponse.json(dbItems || []);
  } catch (err) {
    console.error('[Menu API] Database query failed:', err);
    // Return empty array — run /api/seed to populate the database
    return NextResponse.json([]);
  }
}

// Allowed fields for creating a menu item (whitelist to prevent mass-assignment)
const ALLOWED_FIELDS = [
  'name', 'description', 'price', 'calories', 'protein_g', 'carbs_g',
  'fat_g', 'fiber_g', 'diet', 'category', 'is_available', 'cookable', 'image_url',
] as const;

type AllowedField = (typeof ALLOWED_FIELDS)[number];

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Whitelist-validate input — only allow known fields
    const sanitised: Partial<Record<AllowedField, unknown>> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        sanitised[field] = body[field];
      }
    }

    if (!sanitised.name || typeof sanitised.name !== 'string') {
      return NextResponse.json({ message: 'name is required' }, { status: 400 });
    }
    if (sanitised.name.length > 200) {
      return NextResponse.json({ message: 'name too long' }, { status: 400 });
    }

    const { MenuItem } = await getDbModels();
    const newItem = await (MenuItem as any).create(sanitised);
    return NextResponse.json(newItem, { status: 201 });
  } catch (err) {
    console.error('[Menu API] POST failed:', err);
    return NextResponse.json({ message: 'Failed to create menu item' }, { status: 500 });
  }
}
