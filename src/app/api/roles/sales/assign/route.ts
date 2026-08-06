import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';
import { requireRole } from '@/lib/auth';

export async function PATCH(req: Request) {
  const auth = requireRole(req, ['super_admin', 'admin']);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { enquiry_id, assigned_sales_id } = body;

    if (!enquiry_id || !assigned_sales_id) {
      return NextResponse.json({ message: 'enquiry_id and assigned_sales_id required' }, { status: 400 });
    }

    const { CustomerEnquiry } = await getDbModels();
    const existing = await (CustomerEnquiry as any).findByPk(enquiry_id);
    if (!existing) return NextResponse.json({ message: 'Enquiry not found' }, { status: 404 });

    await (CustomerEnquiry as any).update(
      { assigned_sales_id },
      { where: { id: enquiry_id } }
    );

    const updated = await (CustomerEnquiry as any).findByPk(enquiry_id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[Sales Assign] PATCH:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}
