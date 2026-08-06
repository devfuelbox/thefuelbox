import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET(req: Request) {
  const auth = requireRole(req, ['super_admin', 'admin', 'verifier']);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const { User } = await getDbModels();
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');

    const where: any = {};
    if (role) where.role = role;
    if (auth.user!.role === 'verifier') {
      if (role && !['chef', 'delivery_partner'].includes(role)) {
        return NextResponse.json([]);
      }
      if (!role) where.role = ['chef', 'delivery_partner'];
    }

    const users = await (User as any).findAll({
      where,
      attributes: ['id', 'email', 'role', 'full_name', 'phone', 'is_active', 'created_at'],
      order: [['created_at', 'DESC']],
      raw: true,
    });

    return NextResponse.json(users);
  } catch (err) {
    console.error('[Admin Users] GET:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = requireRole(req, ['super_admin', 'admin']);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { email, password, role, full_name, phone } = body;

    if (!email || !password || !role) {
      return NextResponse.json({ message: 'email, password, role required' }, { status: 400 });
    }

    const validRoles = ['super_admin', 'admin', 'sales', 'verifier', 'chef', 'delivery_partner'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ message: 'Invalid role' }, { status: 400 });
    }

    const { User } = await getDbModels();
    const existing = await (User as any).findOne({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return NextResponse.json({ message: 'Email already exists' }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(String(password), 10);
    const user = await (User as any).create({
      email: email.toLowerCase().trim(),
      password_hash,
      role,
      full_name: full_name || null,
      phone: phone || null,
      is_active: true,
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      phone: user.phone,
      is_active: user.is_active,
    }, { status: 201 });
  } catch (err) {
    console.error('[Admin Users] POST:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = requireRole(req, ['super_admin', 'admin']);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });

    const { User } = await getDbModels();
    const existing = await (User as any).findByPk(id);
    if (!existing) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    const fields: Record<string, any> = {};
    if (updates.full_name !== undefined) fields.full_name = updates.full_name;
    if (updates.phone !== undefined) fields.phone = updates.phone;
    if (updates.role !== undefined) fields.role = updates.role;
    if (updates.is_active !== undefined) fields.is_active = updates.is_active;
    if (updates.password) {
      fields.password_hash = await bcrypt.hash(String(updates.password), 10);
    }

    await (User as any).update(fields, { where: { id } });
    const updated = await (User as any).findByPk(id, {
      attributes: ['id', 'email', 'role', 'full_name', 'phone', 'is_active', 'created_at'],
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[Admin Users] PATCH:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}
