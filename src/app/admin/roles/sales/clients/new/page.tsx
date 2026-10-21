import { redirect } from 'next/navigation';

/** The New Client form now lives at /admin/roles/sales/new — forward old links. */
export default function NewClientRedirect() {
  redirect('/admin/roles/sales/new');
}
