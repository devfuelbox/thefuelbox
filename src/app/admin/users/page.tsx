"use client";

import { Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setUsers(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900">
          User Management & Accounts
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Overview of registered customer accounts, admin roles, and profiles.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-4 px-6">User / Name</th>
                <th className="py-4 px-6">Email</th>
                <th className="py-4 px-6">Phone</th>
                <th className="py-4 px-6">Role</th>
                <th className="py-4 px-6">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="py-4 px-6 font-semibold text-gray-900">
                    {user.email.split("@")[0]}
                  </td>

                  <td className="py-4 px-6 flex items-center gap-2 text-gray-600">
                    <Mail className="w-4 h-4" />
                    {user.email}
                  </td>

                  <td className="py-4 px-6">N/A</td>

                  <td className="py-4 px-6">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                        user.role === "admin"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {user.role === "admin" && (
                        <ShieldCheck className="w-3 h-3" />
                      )}
                      {user.role}
                    </span>
                  </td>

                  <td className="py-4 px-6 text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
