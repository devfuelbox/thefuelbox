import { getDbModels } from '@/lib/db';
import MenuFilter from '../../app/menu/MenuFilter';

export type MenuItemData = {
  id: number;
  name: string;
  description: string | null;
  price: number | string;
  calories: number | string;
  protein_g: number | string;
  carbs_g: number | string;
  fat_g: number | string;
  fiber_g: number | string;
  score: number | string;
  diet: string;
  category: string;
  is_available: boolean;
  cookable: boolean;
  image_url: string | null;
};

export default async function MenuPage() {
  const { MenuItem } = await getDbModels();

  const meals = (await MenuItem.findAll({
    where: {
      is_available: true,
    },
    order: [['id', 'DESC']],
    raw: true,
  })) as unknown as MenuItemData[];

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Header */}
      <section className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-3 py-8 sm:px-6 sm:py-12 lg:px-8">
          <div className="text-center">

            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 sm:text-sm">
              Fresh & Healthy
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-brand-600 sm:text-4xl lg:text-5xl">
              Our Menu
            </h1>

            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
              Delicious and nutritious meals prepared to support your
              health and fitness goals.
            </p>

          </div>
        </div>
      </section>

      {/* Menu Filter + Cards */}
      <MenuFilter meals={meals} />

    </main>
  );
}