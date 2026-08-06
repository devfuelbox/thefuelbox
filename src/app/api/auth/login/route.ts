import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fuelbox_dev_secret_change_in_production';
const JWT_EXPIRES_IN = '7d';

// Simple in-memory rate limiter: max 10 attempts per IP per 15 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

export async function POST(req: Request) {
  // Rate limiting
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { message: 'Too many login attempts. Please try again in 15 minutes.' },
      { status: 429 }
    );
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
    }

    // Sanitise inputs
    const sanitisedEmail = String(email).toLowerCase().trim().slice(0, 254);

    // Look up user in DB
    try {
      console.log(`[Auth] Attempting database login for: ${sanitisedEmail}`);
      const { User } = await getDbModels();
      const user = await (User as any).findOne({ where: { email: sanitisedEmail } });

      if (user) {
        console.log(`[Auth] User found in database: ${user.email} (Role: ${user.role}, Active: ${user.is_active})`);
        if (!user.is_active) {
          console.warn(`[Auth] Login rejected: Account is disabled for ${sanitisedEmail}`);
          return NextResponse.json({ message: 'Account is disabled. Contact admin.' }, { status: 403 });
        }

        const match = await bcrypt.compare(String(password), user.password_hash);
        if (!match) {
          console.warn(`[Auth] Login rejected: Password mismatch for ${sanitisedEmail}`);
          return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
        }

        console.log(`[Auth] Login successful for: ${sanitisedEmail}`);
        const payload = {
          sub: user.id,
          email: user.email,
          role: user.role,
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        return NextResponse.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            full_name: user.full_name || 'FuelBox User',
          },
        });
      } else {
        console.warn(`[Auth] Login rejected: User ${sanitisedEmail} not found in database.`);
      }
    } catch (dbErr: any) {
      console.error('[Auth] Database lookup failed:', dbErr.message || dbErr);
    }

    // Fallback: allow admin/super_admin login if DB is not yet seeded (dev only)
    if (process.env.NODE_ENV !== 'production') {
      if (
        sanitisedEmail === 'admin@fuelbox.com' &&
        String(password) === 'admin123'
      ) {
        const token = jwt.sign(
          { sub: 'admin-1', email: 'admin@fuelbox.com', role: 'super_admin' },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );
        return NextResponse.json({
          token,
          user: { id: 'admin-1', email: 'admin@fuelbox.com', role: 'super_admin', full_name: 'Fuelbox Super Admin' },
        });
      }
    }

    return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return NextResponse.json({ message: 'Authentication failed' }, { status: 400 });
  }
}
