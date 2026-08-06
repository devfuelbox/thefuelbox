import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fuelbox_dev_secret_change_in_production';
const VALID_ROLES = ['super_admin', 'admin', 'sales', 'verifier', 'chef', 'delivery_partner'];

export function verifyToken(req: Request): { valid: boolean; sub?: string; email?: string; role?: string } {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return { valid: false };
  try {
    const d = jwt.verify(auth.slice(7), JWT_SECRET) as { sub?: string; email?: string; role?: string };
    return { valid: true, sub: d.sub, email: d.email, role: d.role };
  } catch { return { valid: false }; }
}

export function requireRole(req: Request, allowedRoles: string[]): { authorized: boolean; user?: { sub: string; email: string; role: string } } {
  const auth = verifyToken(req);
  if (!auth.valid || !auth.sub || !auth.role) return { authorized: false };
  if (!allowedRoles.includes(auth.role)) return { authorized: false };
  return { authorized: true, user: { sub: auth.sub, email: auth.email!, role: auth.role } };
}
