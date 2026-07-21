'use client';

import React, { useMemo } from 'react';
import NextLink from 'next/link';
import { usePathname, useRouter, useSearchParams as useNextSearchParams } from 'next/navigation';

export function Link({ to, href, children, className, style, onClick, ...props }: any) {
  const destination = to || href || '#';
  return (
    <NextLink href={destination} className={className} style={style} onClick={onClick} {...props}>
      {children}
    </NextLink>
  );
}

export function useNavigate() {
  const router = useRouter();
  return (to: string | number, options?: { replace?: boolean; state?: any }) => {
    if (typeof to === 'number') {
      if (to === -1) router.back();
      return;
    }
    if (options?.state) {
      try {
        sessionStorage.setItem('fuelbox_nav_state', JSON.stringify(options.state));
      } catch (_) {}
    }
    if (options?.replace) {
      router.replace(to);
    } else {
      router.push(to);
    }
  };
}

export function useLocation() {
  const pathname = usePathname();
  const searchParams = useNextSearchParams();
  const searchString = searchParams ? searchParams.toString() : '';

  const state = useMemo(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = sessionStorage.getItem('fuelbox_nav_state');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {};
  }, [pathname]);

  return {
    pathname: pathname || '/',
    search: searchString ? `?${searchString}` : '',
    hash: '',
    state,
    key: 'default',
  };
}

export function useSearchParams() {
  const searchParams = useNextSearchParams();
  const router = useRouter();

  const setSearchParams = (params: any) => {
    const newParams = new URLSearchParams(params);
    router.push(`?${newParams.toString()}`);
  };

  const safeParams = useMemo(() => searchParams || new URLSearchParams(), [searchParams]);

  return [safeParams, setSearchParams] as const;
}

export function createBrowserRouter(routes: any) {
  return routes;
}

export function RouterProvider({ router }: any) {
  return null;
}

export function Outlet() {
  return null;
}

export function Navigate({ to, replace, state }: { to: string; replace?: boolean; state?: any }) {
  const router = useRouter();
  React.useEffect(() => {
    if (state) {
      try {
        sessionStorage.setItem('fuelbox_nav_state', JSON.stringify(state));
      } catch (_) {}
    }
    if (replace) router.replace(to);
    else router.push(to);
  }, [to, replace, state, router]);
  return null;
}
