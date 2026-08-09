import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fuelbox_dev_secret_change_in_production';

const ALLOWED_ROLES = ['super_admin', 'admin', 'verifier', 'sales', 'chef', 'delivery_partner'];

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
  const auth = verifyAdminToken(req);
  if (!auth.valid || !ALLOWED_ROLES.includes(auth.role || '')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { MenuItem, User, Order, Customer, Payment } = await getDbModels();

    const totalMenuItems = await (MenuItem as any).count();
    const totalUsers = await (User as any).count();
    const totalOrders = await (Order as any).count();
    const totalCustomers = await (Customer as any).count();

    const orders = await (Order as any).findAll({
      attributes: ['cost', 'status', 'created_at', 'type', 'id', 'phone'],
      raw: true
    });

    const activeOrders = orders.filter((o: any) => o.status !== 'cancelled');
    const totalRevenue = activeOrders.reduce((sum: number, o: any) => sum + Number(o.cost || 0), 0);
    const aov = activeOrders.length > 0 ? totalRevenue / activeOrders.length : 0;

    // Collected Revenue = actual payments collected in the Payment Management
    // module (sum of paid_amount across all payments).
    const payments = await (Payment as any).findAll({
      attributes: ['paid_amount'],
      raw: true,
    });
    const collectedRevenue = payments.reduce((sum: number, p: any) => sum + Number(p.paid_amount || 0), 0);

    const customers = await (Customer as any).findAll({
      attributes: ['goal', 'freq', 'food', 'loc_status', 'loc_km', 'meal_plan', 'created_at'],
      raw: true
    });

    const goals: Record<string, number> = { loss: 0, gain: 0, muscle: 0, maintenance: 0, other: 0 };
    const frequencies: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
    const preferences: Record<string, number> = { veg: 0, egg: 0, nonveg: 0 };
    let totalKm = 0;
    let kmCount = 0;
    let waitlistCount = 0;
    const slots: Record<string, number> = { Morning: 0, Afternoon: 0, Night: 0 };
    const mealPlanNames: Record<string, number> = {};
    const customerGrowth: Record<string, number> = {};

    customers.forEach((c: any) => {
      const g = c.goal || 'other';
      if (g in goals) goals[g]++;
      else goals.other++;

      const fr = String(c.freq);
      if (fr in frequencies) frequencies[fr]++;

      const fd = c.food || 'nonveg';
      if (fd === 'veg') preferences.veg++;
      else if (fd === 'egg') preferences.egg++;
      else preferences.nonveg++;

      if (c.loc_status === 'out') waitlistCount++;
      if (c.loc_km != null) { totalKm += Number(c.loc_km); kmCount++; }

      try {
        const plan = typeof c.meal_plan === 'string' ? JSON.parse(c.meal_plan) : c.meal_plan;
        if (plan?.preferredSlots) {
          plan.preferredSlots.forEach((s: string) => {
            if (s in slots) slots[s]++;
          });
        }
      } catch (_) {}

      const createdDate = c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : null;
      if (createdDate) {
        customerGrowth[createdDate] = (customerGrowth[createdDate] || 0) + 1;
      }
    });

    const avgDistance = kmCount > 0 ? totalKm / kmCount : 0;

    const salesHistory: Record<string, { date: string; sales: number; orders: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      salesHistory[dateString] = { date: dateString, sales: 0, orders: 0 };
    }

    orders.forEach((o: any) => {
      if (o.status !== 'cancelled' && o.created_at) {
        const dateString = new Date(o.created_at).toISOString().split('T')[0];
        if (dateString in salesHistory) {
          salesHistory[dateString].sales += Number(o.cost || 0);
          salesHistory[dateString].orders++;
        }
      }
    });

    const salesHistoryArray = Object.values(salesHistory);

    const recentOrders = await (Order as any).findAll({
      limit: 10,
      order: [['created_at', 'DESC']],
      raw: true
    });

    const popularItems = await (Order as any).findAll({
      attributes: ['menu_selected'],
      raw: true
    });

    const itemPopularity: Record<string, { name: string; count: number; revenue: number }> = {};
    popularItems.forEach((o: any) => {
      let selected = o.menu_selected;
      if (typeof selected === 'string') {
        try { selected = JSON.parse(selected); } catch { selected = []; }
      }
      if (Array.isArray(selected)) {
        selected.forEach((item: any) => {
          const name = item.name || item.id || 'Unknown';
          if (!itemPopularity[name]) {
            itemPopularity[name] = { name, count: 0, revenue: 0 };
          }
          itemPopularity[name].count += Number(item.quantity) || 1;
          itemPopularity[name].revenue += Number(item.price) * (Number(item.quantity) || 1);
        });
      }
    });

    const topItems = Object.values(itemPopularity)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const revenueByType: Record<string, number> = {};
    const orderCountByType: Record<string, number> = {};
    activeOrders.forEach((o: any) => {
      const type = o.type || 'meal';
      revenueByType[type] = (revenueByType[type] || 0) + Number(o.cost || 0);
      orderCountByType[type] = (orderCountByType[type] || 0) + 1;
    });

    return NextResponse.json({
      summary: {
        totalUsers,
        totalOrders,
        totalMenuItems,
        totalCustomers,
        totalRevenue: Math.round(collectedRevenue),
        aov: Math.round(aov),
        waitlistCount,
        avgDistance: Number(avgDistance.toFixed(1))
      },
      goals,
      frequencies,
      preferences,
      slots,
      salesHistory: salesHistoryArray,
      recentOrders: recentOrders.map((o: any) => ({
        id: o.id,
        phone: o.phone,
        cost: Number(o.cost),
        status: o.status,
        type: o.type,
        createdAt: o.created_at
      })),
      popularItems: topItems,
      revenueByType,
      orderCountByType
    });

  } catch (err) {
    console.error('[Admin Stats] DB error:', err);
    return NextResponse.json({ message: 'Failed to fetch stats' }, { status: 500 });
  }
}
