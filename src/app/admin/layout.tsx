'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Utensils, ShoppingBag, Users, LogOut, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem('fuelbox_user_role');
    if (role !== 'admin') {
      router.push('/login');
    } else {
      setAuthorized(true);
    }
  }, [router]);

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto animate-bounce" />
          <p className="text-gray-600 font-bold">Verifying Admin Permissions...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard Overview', icon: LayoutDashboard },
    { href: '/admin/menu', label: 'Manage Food Items & Prices', icon: Utensils },
    { href: '/admin/orders', label: 'Monitor Orders', icon: ShoppingBag },
    { href: '/admin/users', label: 'Registered Users', icon: Users },
  ];

  const handleLogout = () => {
    localStorage.removeItem('fuelbox_token');
    localStorage.removeItem('fuelbox_user_role');
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col justify-between p-6 shadow-xl hidden md:flex">
        <div className="space-y-8">
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-extrabold bg-gradient-to-r from-emerald-400 to-amber-400 bg-clip-text text-transparent">
              FuelBox
            </span>
            <span className="px-2 py-0.5 bg-amber-500 text-white rounded text-[10px] font-bold uppercase">
              Admin
            </span>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                    active
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-950/50 hover:text-red-300 transition"
        >
          <LogOut className="w-5 h-5" />
          <span>Exit Admin</span>
        </button>
      </aside>

      {/* Main View */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <div className="md:hidden flex items-center justify-between bg-gray-900 text-white p-4 rounded-xl mb-6">
          <span className="font-bold text-emerald-400">FuelBox Admin</span>
          <div className="flex gap-2">
            <Link href="/admin/menu" className="text-xs bg-emerald-600 px-3 py-1.5 rounded-lg font-bold">
              Menu
            </Link>
            <Link href="/admin/orders" className="text-xs bg-gray-800 px-3 py-1.5 rounded-lg font-bold">
              Orders
            </Link>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
