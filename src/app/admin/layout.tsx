'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Utensils, ShoppingBag, Users, LogOut, ShieldAlert,
  ChevronLeft, ChevronRight, Menu, X, BarChart3, Settings, HelpCircle, DollarSign, CalendarCheck,
  ClipboardList, CheckSquare, ChefHat, Truck, UserPlus, MapPin, Phone, UserCheck
} from 'lucide-react';
import { useEffect, useState } from 'react';

const ROLE_NAMES: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  sales: 'Sales',
  verifier: 'Verifier',
  chef: 'Chef',
  delivery_partner: 'Delivery',
};

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<any>;
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'from-emerald-400 to-emerald-600',
  admin: 'from-emerald-400 to-emerald-600',
  sales: 'from-blue-400 to-blue-600',
  verifier: 'from-purple-400 to-purple-600',
  chef: 'from-orange-400 to-orange-600',
  delivery_partner: 'from-cyan-400 to-cyan-600',
};

const VALID_ROLES = ['super_admin', 'admin', 'sales', 'verifier', 'chef', 'delivery_partner'];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    const role = localStorage.getItem('fuelbox_user_role') || '';
    if (!VALID_ROLES.includes(role)) {
      router.push('/login');
    } else {
      setUserRole(role);
      setAuthorized(true);
    }
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const isSuperOrAdmin = userRole === 'super_admin' || userRole === 'admin';

  const navItems: NavItem[] = [];

  if (isSuperOrAdmin) {
    navItems.push(
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/enquiries', label: 'Payment', icon: DollarSign },
      { href: '/admin/subscriptions', label: 'Subscriptions', icon: CalendarCheck },
      { href: '/admin/menu', label: 'Menu & Prices', icon: Utensils },
      { href: '/admin/orders', label: 'Customer Enquire', icon: ShoppingBag },
      { href: '/admin/users', label: 'User Management', icon: Users },
    );
  }

  if (isSuperOrAdmin) {
    navItems.push(
      { href: '/admin/roles/manage-users', label: 'Role Management', icon: UserPlus },
      { href: '/admin/roles/delivery-mappings', label: 'Chef-Delivery Map', icon: MapPin },
    );
  }

  if (isSuperOrAdmin) {
    navItems.push(
      { href: '/admin/roles/sales', label: 'Sales Dashboard', icon: ClipboardList },
      { href: '/admin/roles/chef', label: 'Chef Dashboard', icon: ChefHat },
    );
  }

  if (userRole === 'sales') {
    navItems.push(
      { href: '/admin/roles/sales', label: 'Sales Dashboard', icon: ClipboardList },
    );
  }

  if (userRole === 'verifier') {
    navItems.push(
      { href: '/admin/roles/verifier', label: 'Verifier Dashboard', icon: CheckSquare },
      { href: '/admin/enquiries', label: 'Payment', icon: DollarSign },
      { href: '/admin/subscriptions', label: 'Subscriptions', icon: CalendarCheck },
      { href: '/admin/roles/delivery-mappings', label: 'Chef-Delivery Map', icon: MapPin },
      // { href: '/admin/payments', label: 'Payments Ledger', icon: DollarSign },
    );
  }

  if (userRole === 'chef') {
    navItems.push(
      { href: '/admin/roles/chef', label: 'Chef Dashboard', icon: ChefHat },
    );
  }

  if (userRole === 'delivery_partner') {
    navItems.push(
      { href: '/admin/roles/delivery', label: 'Deliveries', icon: Truck },
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto animate-bounce" />
          <p className="text-gray-600 font-bold">Verifying Permissions...</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    localStorage.removeItem('fuelbox_token');
    localStorage.removeItem('fuelbox_user_role');
    localStorage.removeItem('fuelbox_user');
    router.push('/login');
  };

  const sidebarWidth = collapsed ? 'w-20' : 'w-64';
  const logoText = collapsed ? 'FB' : 'FuelBox';
  const roleColor = ROLE_COLORS[userRole] || 'from-emerald-400 to-emerald-600';
  const roleLabel = ROLE_NAMES[userRole] || 'Staff';

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex">
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 ${sidebarWidth} bg-gray-900 text-white flex flex-col transition-all duration-300 ease-in-out transform ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Logo & Toggle Header */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${roleColor} flex items-center justify-center shrink-0`}>
              <span className="text-white font-black text-sm">{logoText[0]}</span>
            </div>
            {!collapsed && (
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-lg font-extrabold bg-gradient-to-r from-emerald-400 to-amber-400 bg-clip-text text-transparent">
                  FuelBox
                </span>
                <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded text-[9px] font-bold uppercase leading-tight">
                  {roleLabel}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition shrink-0"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden flex items-center justify-center w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin scrollbar-thumb-gray-700">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  active
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-white' : ''}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="border-t border-gray-800 p-3 space-y-1 shrink-0">
          {!collapsed && (
            <div className="px-3 py-2 mb-1">
              <p className="text-xs text-gray-500 font-medium">FuelBox {roleLabel}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-950/50 hover:text-red-300 transition w-full ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? 'Logout' : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300`}>
        {/* Top Header Bar (Mobile) */}
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between shadow-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${roleColor} flex items-center justify-center`}>
              <span className="text-white font-black text-xs">FB</span>
            </div>
            <span className="font-bold text-gray-900">{roleLabel}</span>
          </div>
          <div className="w-9" />
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
