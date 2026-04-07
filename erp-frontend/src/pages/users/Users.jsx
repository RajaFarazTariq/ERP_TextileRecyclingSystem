import { useEffect, useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

// ─── Shared input / label classes ─────────────────────────────────────────
const inputCls = 'w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors';
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';

// ─── Role badge colors ─────────────────────────────────────────────────────
const ROLE_COLORS = {
  'admin':                     'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  'warehouse_supervisor':      'bg-blue-100   dark:bg-blue-900/40   text-blue-700   dark:text-blue-300',
  'sorting_supervisor':        'bg-amber-100  dark:bg-amber-900/40  text-amber-700  dark:text-amber-300',
  'decolorization_supervisor': 'bg-teal-100   dark:bg-teal-900/40   text-teal-700   dark:text-teal-300',
  'drying_supervisor':         'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
};

export default function Users() {
  // ─── State ────────────────────────────────────────────────────────────────
  const { user: currentUser } = useAuth();   // logged-in user from context
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState({});
  const [saving, setSaving]         = useState(false);
  const [toggling, setToggling]     = useState(null);  // id of user being toggled
  const [error, setError]           = useState('');
  const [searchText, setSearchText] = useState('');

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('users/list/');
      setUsers(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  // ─── Modal helpers ────────────────────────────────────────────────────────
  const openModal = (item = {}) => {
    // Default is_active to true for new users
    setForm(item.id ? item : { ...item, is_active: true });
    setError('');
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setForm({}); setError(''); };
  const handleChange = e => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [e.target.name]: val });
  };

  // ─── Save (create or update) ──────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      if (form.id) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.put(`users/detail/${form.id}/`, payload);
      } else {
        await api.post('users/register/', form);
      }
      await fetchUsers();
      closeModal();
    } catch (e) {
      setError(
        e.response?.data
          ? Object.values(e.response.data).flat().join(' ')
          : 'Something went wrong.'
      );
    } finally { setSaving(false); }
  };

  // ─── Toggle active / inactive ─────────────────────────────────────────────
  const handleToggleActive = async (userId) => {
    setToggling(userId);
    try {
      await api.post(`users/toggle-active/${userId}/`);
      await fetchUsers();  // refresh list to show updated status
    } catch {
      alert('Could not change user status.');
    } finally { setToggling(null); }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try { await api.delete(`users/detail/${id}/`); fetchUsers(); }
    catch { alert('Could not delete user.'); }
  };

  // ─── Filtered list ────────────────────────────────────────────────────────
  const filteredUsers = searchText
    ? users.filter(u =>
        u.username.toLowerCase().includes(searchText.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchText.toLowerCase())
      )
    : users;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <PageHeader
        title="User Management"
        subtitle="Create and manage system users and their roles."
        action={
          <button onClick={() => openModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
        }
      />

      {/* ── Role stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {[
          { role: 'admin',                     label: 'Admins'                     },
          { role: 'warehouse_supervisor',      label: 'Warehouse Supervisors'      },
          { role: 'sorting_supervisor',        label: 'Sorting Supervisors'        },
          { role: 'decolorization_supervisor', label: 'Decolorization Supervisors' },
          { role: 'drying_supervisor',         label: 'Drying Supervisors'         },
        ].map(r => (
          <div key={r.role}
            className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-3 text-center transition-colors duration-200">
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {users.filter(u => u.role === r.role).length}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{r.label}</p>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden transition-colors duration-200">

      {/* Search */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700/60 flex justify-end">
        <input
            placeholder="Search by username or email..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        />
        </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700/60">
                <tr>
                  {['#', 'Username', 'Email', 'Role', 'Status', 'Last Login', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400 dark:text-slate-500">
                      No users found.
                    </td>
                  </tr>
                ) : filteredUsers.map((u, i) => {
                  // Is this the currently logged-in user?
                  const isCurrentUser = u.id === currentUser?.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">

                      {/* # */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{i + 1}</td>

                      {/* Username + avatar */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-xs font-semibold">
                                {u.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            {/* Green dot for currently logged-in user */}
                            {isCurrentUser && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full" />
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-slate-800 dark:text-slate-200">{u.username}</span>
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-medium">(you)</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{u.email || '—'}</td>

                      {/* Role badge */}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                          {u.role?.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Status — shows Active if currently logged in OR is_active is true */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            (u.is_active || isCurrentUser)
                              ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                              : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                          }`}>
                            {(u.is_active || isCurrentUser) ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>

                      {/* Last login */}
                      <td className="px-4 py-3">
                        {isCurrentUser ? (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            Online now
                          </span>
                        ) : u.last_login_display && u.last_login_display !== 'Never' ? (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {u.last_login_display}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500 italic">Never</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {/* Toggle Active/Inactive — don't allow toggling yourself */}
                          {!isCurrentUser && (
                            <button
                              onClick={() => handleToggleActive(u.id)}
                              disabled={toggling === u.id}
                              title={u.is_active ? 'Deactivate user' : 'Activate user'}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                u.is_active
                                  ? 'bg-green-500 hover:bg-green-600'
                                  : 'bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'
                              } ${toggling === u.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                u.is_active ? 'translate-x-4' : 'translate-x-0.5'
                              }`} />
                            </button>
                          )}

                          <button
                            onClick={() => openModal(u)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs font-medium">
                            Edit
                          </button>
                          {/* Don't allow deleting yourself */}
                          {!isCurrentUser && (
                            <button
                              onClick={() => handleDelete(u.id)}
                              className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs font-medium">
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700/60 transition-colors duration-200">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700/60">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">
                {form.id ? 'Edit User' : 'Add New User'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Username */}
              <div>
                <label className={labelCls}>Username</label>
                <input name="username" value={form.username || ''} onChange={handleChange}
                  placeholder="Enter username" className={inputCls} />
              </div>

              {/* Email */}
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" name="email" value={form.email || ''} onChange={handleChange}
                  placeholder="Enter email (optional)" className={inputCls} />
              </div>

              {/* Password */}
              <div>
                <label className={labelCls}>
                  Password{' '}
                  {form.id && (
                    <span className="text-slate-400 dark:text-slate-500 font-normal">
                      (leave blank to keep current)
                    </span>
                  )}
                </label>
                <input type="password" name="password" value={form.password || ''} onChange={handleChange}
                  placeholder={form.id ? 'Leave blank to keep current' : 'Enter password'}
                  className={inputCls} />
              </div>

              {/* Role */}
              <div>
                <label className={labelCls}>Role</label>
                <select name="role" value={form.role || 'admin'} onChange={handleChange} className={inputCls}>
                  <option value="admin">Admin</option>
                  <option value="warehouse_supervisor">Warehouse Supervisor</option>
                  <option value="sorting_supervisor">Sorting Supervisor</option>
                  <option value="decolorization_supervisor">Decolorization Supervisor</option>
                  <option value="drying_supervisor">Drying Supervisor</option>
                </select>
              </div>

              {/* Active / Inactive toggle — visible for both new and existing users */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Account Status
                  </label>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    Inactive users cannot log in
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, is_active: !prev.is_active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    form.is_active !== false
                      ? 'bg-green-500'
                      : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    form.is_active !== false ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <span className={`ml-3 text-sm font-medium ${
                  form.is_active !== false
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {form.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 border-t border-slate-200 dark:border-slate-700/60">
              <button onClick={closeModal}
                className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                {saving
                  ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</>
                  : (form.id ? 'Update User' : 'Create User')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
