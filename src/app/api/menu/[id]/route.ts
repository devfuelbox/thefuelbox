import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';

const ALLOWED_FIELDS = [
  'name',
  'description',
  'price',
  'price_unit',
  'calories',
  'protein_g',
  'carbs_g',
  'fat_g',
  'fiber_g',
  'diet',
  'category',
  'is_available',
  'cookable',
  'image_url',
] as const;

type AllowedField = (typeof ALLOWED_FIELDS)[number];

function normalizeImageUrlForStorage(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let p = raw.trim();
  if (p.startsWith('http://') || p.startsWith('https://')) {
    try {
      const u = new URL(p);
      const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.pathname.startsWith('/images/') || u.pathname.startsWith('/uploads/');
      if (isLocal) p = u.pathname;
      else return p;
    } catch {}
  }
  if (!p.startsWith('/') && !p.startsWith('data:') && !p.startsWith('blob:')) p = `/${p}`;
  if (/^\/[^/]+\.(jpg|jpeg|png|webp|avif|gif|svg)$/i.test(p) && !p.startsWith('/images/') && !p.startsWith('/uploads/')) {
    p = `/images${p}`;
  }
  return p;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { MenuItem } = await getDbModels();
    const item = await (MenuItem as any).findByPk(params.id);
    if (!item) {
      return NextResponse.json({ message: 'Menu item not found' }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (err) {
    console.error('[Menu API] GET by id failed:', err);
    return NextResponse.json({ message: 'Failed to fetch menu item' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { MenuItem } = await getDbModels();
    const item = await (MenuItem as any).findByPk(params.id);
    if (!item) {
      return NextResponse.json({ message: 'Menu item not found' }, { status: 404 });
    }

    const sanitised: Partial<Record<AllowedField, unknown>> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        sanitised[field] = body[field];
      }
    }

    // Validate diet enum if provided
    if ('diet' in sanitised && sanitised.diet !== undefined) {
      const allowedDiets = ['veg', 'egg', 'non_veg'];
      if (typeof sanitised.diet !== 'string' || !allowedDiets.includes((sanitised.diet as string).toLowerCase())) {
        return NextResponse.json({ message: 'Invalid diet type. Allowed: veg, egg, non_veg' }, { status: 400 });
      }
      sanitised.diet = (sanitised.diet as string).toLowerCase();
    }

    // Coerce numeric nutrition fields if they are strings
    const numericFields: AllowedField[] = ['price', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'];
    for (const f of numericFields) {
      if (f in sanitised && sanitised[f] !== null && sanitised[f] !== undefined && sanitised[f] !== '') {
        const n = Number(sanitised[f]);
        if (!isNaN(n)) sanitised[f] = n;
      }
    }

    // Normalize image_url to relative path — never store https://localhost:3000...
    if ('image_url' in sanitised && sanitised.image_url != null && sanitised.image_url !== '') {
      const normalized = normalizeImageUrlForStorage(sanitised.image_url);
      if (normalized) sanitised.image_url = normalized;
      else delete (sanitised as any)['image_url'];
    }

    // Ignore price_unit if column doesn't exist yet (fallback to not failing)
    // Sync will add column if model defines it; otherwise strip it
    try {
      const attributes = (MenuItem as any).getAttributes?.();
      if (attributes && !attributes['price_unit'] && 'price_unit' in sanitised) {
        delete (sanitised as any)['price_unit'];
      }
    } catch {
      // ignore
    }

    if (Object.keys(sanitised).length === 0) {
      return NextResponse.json({ message: 'No valid fields to update' }, { status: 400 });
    }

    await item.update(sanitised);
    const updated = await (MenuItem as any).findByPk(params.id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[Menu API] PATCH failed:', err);
    return NextResponse.json({ message: 'Failed to update menu item' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { MenuItem } = await getDbModels();
    const item = await (MenuItem as any).findByPk(params.id);
    if (!item) {
      return NextResponse.json({ message: 'Menu item not found' }, { status: 404 });
    }
    await item.destroy();
    return NextResponse.json({ success: true, id: params.id });
  } catch (err) {
    console.error('[Menu API] DELETE failed:', err);
    return NextResponse.json({ message: 'Failed to delete menu item' }, { status: 500 });
  }
}
