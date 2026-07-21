import { NextResponse } from "next/server";
import { getDbModels } from "@/lib/db";

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

    return NextResponse.json(
      { message: "Failed to fetch users" },
      { status: 500 }
    );
  }
}