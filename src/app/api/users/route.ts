import { NextResponse } from "next/server";
import { getDbModels } from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fuelbox_dev_secret_change_in_production";

function verifyAdmin(req: Request): boolean {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  try {
    const d = jwt.verify(auth.slice(7), JWT_SECRET) as { role?: string };
    return d.role === "admin";
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const { User } = await getDbModels();

    const users = await User.findAll({
      attributes: ["id", "email", "role", "created_at"],
      order: [["created_at", "DESC"]],
      raw: true,
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ message: "Failed to fetch users" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!verifyAdmin(req)) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const { id, email, password } = body;
    if (!id) return NextResponse.json({ message: "id required" }, { status: 400 });

    const { User } = await getDbModels();
    const user = await (User as any).findByPk(id);
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const updates: Record<string, any> = {};
    if (email !== undefined) {
      const existing = await (User as any).findOne({ where: { email }, raw: true });
      if (existing && existing.id !== id) {
        return NextResponse.json({ message: "Email already in use" }, { status: 409 });
      }
      updates.email = email;
    }
    if (password !== undefined && password) {
      updates.password_hash = await bcrypt.hash(String(password), 12);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: "Nothing to update" }, { status: 400 });
    }

    await (User as any).update(updates, { where: { id } });
    const updated = await (User as any).findByPk(id, { attributes: ["id", "email", "role", "created_at"] });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json({ message: "Failed to update user" }, { status: 500 });
  }
}
