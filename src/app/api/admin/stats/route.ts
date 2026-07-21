import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fuelbox_dev_secret_change_in_production';

function verifyAdminToken(req: Request): { valid: boolean; role?: string } {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false };
  }
  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { role?: string };
    return { valid: true, role: decoded.role };
  } catch {
    return { valid: false };
  }
}

export async function GET(req: Request) {
  // Require a valid admin JWT
  const auth = verifyAdminToken(req);
  if (!auth.valid || auth.role !== 'admin') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { MenuItem, User, Order } = await getDbModels();
    const totalMenuItems = await (MenuItem as any).count();
    const totalUsers = await (User as any).count();
    const totalOrders = await (Order as any).count();

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      totalOrders: totalOrders || 0,
      totalMenuItems: totalMenuItems || 0,
      activeSubscriptions: 0,
      totalRevenue: 0,
    });
  } catch (err) {
    console.error('[Admin Stats] DB error:', err);
    return NextResponse.json({ message: 'Failed to fetch stats' }, { status: 500 });
  }
}
