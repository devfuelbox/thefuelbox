import { NextResponse } from "next/server";
import { getDbModels } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Op } from "sequelize";

async function nextOrderId(Customer: any) {
  const count = await Customer.count({
    where: { id: { [Op.like]: "FB-%" } },
  });
  return `FB-${String(count + 1).padStart(2, "0")}`;
}

async function createCustomerWithOrderId(Customer: any, fields: any) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = await nextOrderId(Customer);
    try {
      return await Customer.create({ ...fields, id });
    } catch (err: any) {
      const isDuplicate =
        err?.name === "SequelizeUniqueConstraintError" ||
        /duplicate|unique/i.test(err?.message || "");
      if (!isDuplicate || attempt === 4) throw err;
    }
  }
  throw new Error("Failed to assign a unique order id");
}

export async function POST(req: Request) {
  const auth = requireRole(req, ["super_admin", "admin", "sales"]);
  if (!auth.authorized) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const data = await req.json();
    const {
      name,
      phone,
      email,
      address,
      goal,
      age,
      gender,
      height,
      weight,
      food,
      activity,
      freq,
      loc_status,
      loc_km,
      loc_fee,
      loc_lat,
      loc_lng,
      meal_plan,
      meal_plan_price,
      meal_plan_packages,
    } = data;

    if (!name || !phone) {
      return NextResponse.json({ message: "Name and phone are required" }, { status: 400 });
    }
    if (!/^[6-9]\d{9}$/.test(String(phone).replace(/\D/g, ""))) {
      return NextResponse.json({ message: "Valid 10-digit phone required" }, { status: 400 });
    }

    const { Customer } = await getDbModels();

    let customer = await (Customer as any).findOne({ where: { phone } });

    const fields: any = {
      name: String(name).trim(),
      phone: String(phone).trim(),
      email: email || null,
      address: address || null,
      goal: goal || null,
      age: age ? Number(age) : null,
      gender: gender || null,
      height: height ? Number(height) : null,
      weight: weight ? Number(weight) : null,
      food: food || null,
      activity: activity || null,
      freq: freq ? Number(freq) : null,
      loc_status: loc_status || null,
      loc_km: loc_km != null ? Number(loc_km) : null,
      loc_fee: loc_fee != null ? Number(loc_fee) : null,
      loc_lat: loc_lat != null ? Number(loc_lat) : null,
      loc_lng: loc_lng != null ? Number(loc_lng) : null,
      meal_plan: meal_plan || null,
      meal_plan_price: meal_plan_price != null ? Number(meal_plan_price) : 0,
      meal_plan_packages: meal_plan_packages || null,
    };

    // Avoid duplicate: if exists, update
    if (customer) {
      await customer.update(fields);
    } else {
      customer = await createCustomerWithOrderId(Customer, fields);
    }

    return NextResponse.json(customer, { status: 201 });
  } catch (err: any) {
    console.error("[Customers] POST:", err);
    return NextResponse.json({ message: err.message || "Failed to create customer" }, { status: 500 });
  }
}

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

export async function DELETE(req: Request) {
  const auth = requireRole(req, ["super_admin"]);
  if (!auth.authorized) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ message: "id required" }, { status: 400 });

    const { Customer, CustomerEnquiry, MealPlanSubscription, MealDelivery } = await getDbModels();

    const customer = await (Customer as any).findByPk(id);
    if (!customer) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const sequelize = (Customer as any).sequelize;

    await sequelize.transaction(async (t: any) => {
      const enquiries = await (CustomerEnquiry as any).findAll({
        where: { phone: customer.phone },
        transaction: t,
      });

      for (const enquiry of enquiries) {
        const subscriptions = await (MealPlanSubscription as any).findAll({
          where: { customer_enquiry_id: enquiry.id },
          transaction: t,
        });
        for (const sub of subscriptions) {
          await (MealDelivery as any).destroy({
            where: { subscription_id: sub.id },
            transaction: t,
          });
        }
        await (MealPlanSubscription as any).destroy({
          where: { customer_enquiry_id: enquiry.id },
          transaction: t,
        });
      }

      await (CustomerEnquiry as any).destroy({
        where: { phone: customer.phone },
        transaction: t,
      });

      await (Customer as any).destroy({ where: { id }, transaction: t });
    });

    return NextResponse.json({ message: "Customer deleted successfully" });
  } catch (error) {
    console.error("[Customers] DELETE:", error);
    return NextResponse.json({ message: "Failed to delete customer" }, { status: 500 });
  }
}