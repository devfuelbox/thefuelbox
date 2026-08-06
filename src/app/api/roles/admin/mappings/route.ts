import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';
import { requireRole } from '@/lib/auth';

export async function GET(req: Request) {
  const auth = requireRole(req, ['super_admin', 'admin', 'verifier']);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const { ChefDeliveryMapping } = await getDbModels();
    const rows = await (ChefDeliveryMapping as any).findAll({
      where: { is_active: true },
      raw: true,
    });
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[Mappings] GET:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = requireRole(req, ['super_admin', 'admin', 'verifier']);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { chef_id, delivery_partner_id } = body;

    if (!chef_id || !delivery_partner_id) {
      return NextResponse.json({ message: 'chef_id and delivery_partner_id required' }, { status: 400 });
    }

    const { ChefDeliveryMapping } = await getDbModels();
    const existing = await (ChefDeliveryMapping as any).findOne({
      where: { chef_id, delivery_partner_id, is_active: true },
    });

    if (existing) {
      return NextResponse.json({ message: 'Mapping already exists' }, { status: 409 });
    }

    const mapping = await (ChefDeliveryMapping as any).create({
      chef_id,
      delivery_partner_id,
      is_active: true,
    });

    return NextResponse.json(mapping, { status: 201 });
  } catch (err) {
    console.error('[Mappings] POST:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = requireRole(req, ['super_admin', 'admin', 'verifier']);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });

    const { ChefDeliveryMapping } = await getDbModels();
    const existing = await (ChefDeliveryMapping as any).findByPk(id);
    if (!existing) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    const fields: Record<string, any> = {};
    if (updates.is_active !== undefined) fields.is_active = updates.is_active;
    if (updates.chef_id !== undefined) fields.chef_id = updates.chef_id;
    if (updates.delivery_partner_id !== undefined) fields.delivery_partner_id = updates.delivery_partner_id;

    await (ChefDeliveryMapping as any).update(fields, { where: { id } });
    const updated = await (ChefDeliveryMapping as any).findByPk(id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[Mappings] PATCH:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}
