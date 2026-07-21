import { NextResponse } from "next/server";
import { getDbModels } from "@/lib/db";

export async function GET() {
  try {
    const { Customer } = await getDbModels();

    const customers = await Customer.findAll({
      order: [["created_at", "DESC"]],
      raw: true,
    });

    return NextResponse.json(customers);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}