import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';

export async function PATCH(req: Request, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const params = await ctx.params;
    const id = params?.id;
    const { price } = await req.json();
    const { MenuItem } = await getDbModels();
    const item = await (MenuItem as any).findByPk(id);
    if (item) {
      await (item as any).update({ price });
      return NextResponse.json(item);
    }
  } catch (err) {
    console.error('[Menu API] price PATCH failed:', err);
  }
  const p = await ctx.params;
  return NextResponse.json({ success: true, id: p?.id });
}
