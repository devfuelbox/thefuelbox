import { NextResponse } from "next/server";
import { getDbModels } from "@/lib/db";
import { requireRole } from "@/lib/auth";

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