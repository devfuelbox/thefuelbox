import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fuelbox_dev_secret_change_in_production';

function verifyAdminToken(req: Request): { valid: boolean; role?: string } {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { valid: false };
  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as { role?: string };
    return { valid: true, role: decoded.role };
  } catch {
    return { valid: false };
  }
}

function computeStatus(total: number, paid: number): string {
  if (total <= 0) return 'pending';
  if (paid >= total) return 'paid';
  if (paid > 0) return 'partially_paid';
  return 'pending';
}

export async function GET(req: Request) {
  const auth = verifyAdminToken(req);
  if (!auth.valid || !['admin', 'super_admin', 'verifier'].includes(auth.role || '')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { Payment } = await getDbModels();
    const payments = await (Payment as any).findAll({
      order: [['created_at', 'DESC']],
      raw: true,
    });
    return NextResponse.json(payments);
  } catch (err) {
    console.error('[Payments API] GET failed:', err);
    return NextResponse.json({ message: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = verifyAdminToken(req);
  if (!auth.valid || !['admin', 'super_admin', 'verifier'].includes(auth.role || '')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { Payment } = await getDbModels();

    const total = Number(body.total_amount) || 0;
    const paid = Number(body.paid_amount) || 0;
    const outstanding = Math.max(0, total - paid);

    const payment = await (Payment as any).create({
      customer_name: body.customer_name,
      phone: body.phone,
      email: body.email || null,
      address: body.address || null,
      enquiry_date: body.enquiry_date || null,
      service: body.service || 'meal_plan',
      total_amount: total,
      paid_amount: paid,
      outstanding_amount: outstanding,
      payment_method: body.payment_method || null,
      payment_date: body.payment_date || null,
      payment_status: computeStatus(total, paid),
      notes: body.notes || null,
      payment_history: paid > 0
        ? [{
            amount: paid,
            method: body.payment_method || 'cash',
            date: body.payment_date || new Date().toISOString().split('T')[0],
            note: 'Initial payment',
          }]
        : [],
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (err) {
    console.error('[Payments API] POST failed:', err);
    return NextResponse.json({ message: 'Failed to create payment' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = verifyAdminToken(req);
  if (!auth.valid || !['admin', 'super_admin', 'verifier'].includes(auth.role || '')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ message: 'id is required' }, { status: 400 });
    }

    const { Payment } = await getDbModels();
    const existing = await (Payment as any).findByPk(id);
    if (!existing) {
      return NextResponse.json({ message: 'Payment not found' }, { status: 404 });
    }

    const total = Number(updates.total_amount ?? existing.total_amount) || 0;
    const paid = Number(updates.paid_amount ?? existing.paid_amount) || 0;
    const outstanding = Math.max(0, total - paid);

    // Build payment history if a new additional payment is logged
    let paymentHistory = existing.payment_history || [];
    if (typeof paymentHistory === 'string') {
      try { paymentHistory = JSON.parse(paymentHistory); } catch { paymentHistory = []; }
    }

    if (updates.additional_payment && Number(updates.additional_payment) > 0) {
      const extraAmount = Number(updates.additional_payment);
      paymentHistory = [
        ...paymentHistory,
        {
          amount: extraAmount,
          method: updates.payment_method || 'cash',
          date: updates.payment_date || new Date().toISOString().split('T')[0],
          note: updates.payment_note || 'Additional payment',
        },
      ];
    }

    await (Payment as any).update({
      customer_name: updates.customer_name ?? existing.customer_name,
      phone: updates.phone ?? existing.phone,
      email: updates.email ?? existing.email,
      address: updates.address ?? existing.address,
      enquiry_date: updates.enquiry_date ?? existing.enquiry_date,
      service: updates.service ?? existing.service,
      total_amount: total,
      paid_amount: updates.additional_payment
        ? Number(existing.paid_amount) + Number(updates.additional_payment)
        : paid,
      outstanding_amount: outstanding,
      payment_method: updates.payment_method ?? existing.payment_method,
      payment_date: updates.payment_date ?? existing.payment_date,
      payment_status: computeStatus(total, updates.additional_payment
        ? Number(existing.paid_amount) + Number(updates.additional_payment)
        : paid),
      notes: updates.notes ?? existing.notes,
      payment_history: paymentHistory,
    }, { where: { id } });

    const updated = await (Payment as any).findByPk(id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[Payments API] PATCH failed:', err);
    return NextResponse.json({ message: 'Failed to update payment' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = verifyAdminToken(req);
  if (!auth.valid || !['admin', 'super_admin', 'verifier'].includes(auth.role || '')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ message: 'id is required' }, { status: 400 });
    }

    const { Payment } = await getDbModels();
    await (Payment as any).destroy({ where: { id } });
    return NextResponse.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[Payments API] DELETE failed:', err);
    return NextResponse.json({ message: 'Failed to delete payment' }, { status: 500 });
  }
}
