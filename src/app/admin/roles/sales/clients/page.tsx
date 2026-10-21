import { redirect } from 'next/navigation';

/**
 * The Clients page is the Sales Dashboard landing page itself
 * (`/admin/roles/sales`), so this older path simply forwards there. Keeping the
 * redirect means existing links and bookmarks still work while there is only
 * one canonical Clients page to maintain.
 */
export default function ClientsRedirect() {
  redirect('/admin/roles/sales');
}
