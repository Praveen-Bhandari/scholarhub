"use client";

import { useCallback, useEffect, useState } from "react";
import FormError from "./FormError";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { dangerButton, inputClass, secondaryButton } from "@/lib/ui";
import { useAction } from "@/lib/useAction";
import type { AdminUser, AdminUserList, Role } from "@/lib/types";

function UserRow({ user, onChange }: { user: AdminUser; onChange: () => Promise<void> }) {
  const update = useAction(onChange);

  function changeRole(role: Role) {
    if (role === user.role) return;
    if (window.confirm(`Change ${user.name} from ${user.role} to ${role}? They will be logged out.`)) {
      update.run(() => api(`/admin/users/${user.id}`, { method: "PATCH", body: { role } }));
    }
  }

  function toggleActive() {
    const next = !user.isActive;
    const msg = next ? `Reactivate ${user.name}?` : `Deactivate ${user.name}? They will be logged out.`;
    if (window.confirm(msg)) {
      update.run(() => api(`/admin/users/${user.id}`, { method: "PATCH", body: { isActive: next } }));
    }
  }

  return (
    <tr>
      <td className="px-4 py-3 font-medium">{user.name}</td>
      <td className="px-4 py-3 text-slate-600">
        {user.email}
        {!user.isEmailVerified && <span className="ml-2 text-xs text-amber-600">unverified</span>}
        <FormError error={update.error} />
      </td>
      <td className="px-4 py-3">
        <select
          value={user.role}
          disabled={update.busy}
          onChange={(e) => changeRole(e.target.value as Role)}
          className={`${inputClass} w-32 py-1`}
          aria-label={`Role of ${user.name}`}
        >
          <option value="student">Student</option>
          <option value="instructor">Instructor</option>
          <option value="admin">Admin</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            user.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
          }`}
        >
          {user.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-600">{formatDate(user.createdAt)}</td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          disabled={update.busy}
          onClick={toggleActive}
          className={user.isActive ? dangerButton : secondaryButton}
        >
          {user.isActive ? "Deactivate" : "Activate"}
        </button>
      </td>
    </tr>
  );
}

export default function AdminUsers() {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminUserList | null>(null);
  const [error, setError] = useState<string | null>(null);

  // search box: 300ms ruk kar hi request jaye
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const queryString = useCallback(() => {
    const p = new URLSearchParams({ page: String(page), limit: "10" });
    if (q) p.set("q", q);
    if (role) p.set("role", role);
    if (status) p.set("status", status);
    return p.toString();
  }, [page, q, role, status]);

  const load = useCallback(async () => {
    setData(await api<AdminUserList>(`/admin/users?${queryString()}`));
  }, [queryString]);

  useEffect(() => {
    let cancelled = false;
    api<AdminUserList>(`/admin/users?${queryString()}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          maxLength={100}
          placeholder="Search name or email"
          className={`${inputClass} max-w-xs`}
          aria-label="Search users"
        />
        <select
          value={role}
          onChange={(e) => { setRole(e.target.value); setPage(1); }}
          className={`${inputClass} w-40`}
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="instructor">Instructors</option>
          <option value="admin">Admins</option>
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className={`${inputClass} w-40`}
          aria-label="Filter by status"
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
      {!data && !error && <p className="text-slate-500">Loading users...</p>}

      {data && data.users.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No users match these filters.
        </p>
      )}

      {data && data.users.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.users.map((u) => (
                  <UserRow key={u.id} user={u} onChange={load} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>
              Page {data.pagination.page} of {Math.max(1, data.pagination.totalPages)} · {data.pagination.total} users
            </span>
            <div className="flex gap-2">
              <button className={secondaryButton} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <button className={secondaryButton} disabled={!data.pagination.hasNext} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}