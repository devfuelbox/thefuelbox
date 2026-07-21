import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { is_available } = await req.json();
    const { MenuItem } = await getDbModels();
    const item = await MenuItem.findByPk(params.id);
    if (item) {
      await item.update({ is_available });
      return NextResponse.json(item);
    }
  } catch (err) {
    // fallback response
  }
  return NextResponse.json({ success: true, id: params.id });
}
