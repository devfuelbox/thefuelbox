// import { useLocation, Link } from 'react-router-dom'
// import { useAuthStore } from '@/store/authStore'
// import { ROUTES } from '@/lib/constants'
// import { Home, Utensils, Flame, Receipt, Gift, User } from 'lucide-react'

// export default function BottomNav() {
//   const location = useLocation()
//   const { user } = useAuthStore()
//   const currentPath = location.pathname

//   // Configurable nav structure
//   const config = [
//     {
//       label: 'Home',
//       icon: Home,
//       getPath: (isAuth: boolean) => isAuth ? ROUTES.HOME : ROUTES.LANDING,
//       isActive: (path: string) => path === '/' || path === '/home',
//     },
//     {
//       label: 'Menu',
//       icon: Utensils,
//       getPath: () => ROUTES.MENU,
//       isActive: (path: string) => path.startsWith('/menu'),
//     },
//     ...(user ? [{
//       label: 'Nutrition',
//       icon: Flame,
//       getPath: () => ROUTES.NUTRITION,
//       isActive: (path: string) => path.startsWith('/nutrition'),
//     }] : []),
//     {
//       label: user ? 'Orders' : 'Plans',
//       icon: Receipt,
//       getPath: (isAuth: boolean) => isAuth ? ROUTES.ORDERS : ROUTES.SUBSCRIPTIONS,
//       isActive: (path: string) =>
//         ['/orders', '/plans', '/order-status', '/summary', '/checkout', '/payment'].includes(path),
//     },
//     ...(user ? [
//       {
//         label: 'Rewards',
//         icon: Gift,
//         getPath: () => ROUTES.REWARDS,
//         isActive: (path: string) => path === '/rewards',
//       },
//       {
//         label: 'Profile',
//         icon: User,
//         getPath: () => ROUTES.PROFILE,
//         isActive: (path: string) => path === '/profile',
//       }
//     ] : []),
//   ]

//   return (
//     <nav
//       className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200/50 bg-white/80 backdrop-blur-lg shadow-[0_-4px_24px_rgba(0,0,0,0.06)] md:hidden"
//       style={{
//         paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
//         paddingTop: '8px',
//       }}
//     >
//       <div className="mx-auto flex max-w-md items-center justify-around px-2">
//         {config.map((item) => {
//           const Icon = item.icon
//           const to = item.getPath(!!user)
//           const active = item.isActive(currentPath)

//           return (
//             <Link
//               key={item.label}
//               to={to}
//               aria-label={item.label}
//               className="flex flex-col items-center gap-1 text-center transition-all duration-200 active:scale-95"
//               style={{ minWidth: '56px' }}
//             >
//               <div
//                 className={`flex items-center justify-center p-1 rounded-xl transition-colors duration-200 ${
//                   active
//                     ? 'text-brand-600 bg-brand-50'
//                     : 'text-gray-400 hover:text-gray-600'
//                 }`}
//               >
//                 <Icon className="h-5 w-5" />
//               </div>
//               <span
//                 className={`text-[10px] font-semibold tracking-wide transition-colors duration-200 ${
//                   active ? 'text-brand-700 font-bold' : 'text-gray-500'
//                 }`}
//               >
//                 {item.label}
//               </span>
//             </Link>
//           )
//         })}
//       </div>
//     </nav>
//   )
// }


'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Utensils,
  Flame,
  Receipt,
  Gift,
  User,
} from 'lucide-react';

import { useAuthStore } from '@/store/authStore';
import { ROUTES } from '@/lib/constants';

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const currentPath = pathname || '/';

  const config = [
    {
      label: 'Home',
      icon: Home,
      getPath: (isAuth: boolean) =>
        isAuth ? ROUTES.HOME : ROUTES.LANDING,

      isActive: (path: string) =>
        path === '/' || path === '/home',
    },

    {
      label: 'Menu',
      icon: Utensils,
      getPath: () => ROUTES.MENU,

      isActive: (path: string) =>
        path.startsWith('/menu'),
    },

    ...(user
      ? [
          {
            label: 'Nutrition',
            icon: Flame,
            getPath: () => ROUTES.NUTRITION,

            isActive: (path: string) =>
              path.startsWith('/nutrition'),
          },
        ]
      : []),

    {
      label: user ? 'Orders' : 'Plans',
      icon: Receipt,

      // Logged-in user → Orders
      // Guest user → Static Plans page
      getPath: (isAuth: boolean) =>
        isAuth ? ROUTES.ORDERS : '/plans',

      isActive: (path: string) =>
        user
          ? [
              '/orders',
              '/order-status',
              '/summary',
              '/checkout',
              '/payment',
            ].some((route) =>
              path.startsWith(route)
            )
          : path.startsWith('/plans'),
    },

    ...(user
      ? [
          {
            label: 'Rewards',
            icon: Gift,
            getPath: () => ROUTES.REWARDS,

            isActive: (path: string) =>
              path.startsWith('/rewards'),
          },

          {
            label: 'Profile',
            icon: User,
            getPath: () => ROUTES.PROFILE,

            isActive: (path: string) =>
              path.startsWith('/profile'),
          },
        ]
      : []),
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200/50 bg-white/80 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-lg md:hidden"
      style={{
        paddingBottom:
          'calc(6px + env(safe-area-inset-bottom, 0px))',
        paddingTop: '8px',
      }}
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2">
        {config.map((item) => {
          const Icon = item.icon;

          const to = item.getPath(!!user);

          const active =
            item.isActive(currentPath);

          return (
            <Link
              key={item.label}
              href={to}
              aria-label={item.label}
              className="flex flex-col items-center gap-1 text-center transition-all duration-200 active:scale-95"
              style={{
                minWidth: '56px',
              }}
            >
              <div
                className={`flex items-center justify-center rounded-xl p-1 transition-colors duration-200 ${
                  active
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>

              <span
                className={`text-[10px] tracking-wide transition-colors duration-200 ${
                  active
                    ? 'font-bold text-brand-700'
                    : 'font-semibold text-gray-500'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}