import { useState } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/AuthContext';

export default function MainLayout({ children }) {
  const { user, darkMode, toggleDarkMode } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 transition-colors duration-200">

      {/* ── Sidebar drawer ── */}
      <div
        className={`fixed left-0 top-0 h-full z-50 transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onMouseLeave={() => setSidebarOpen(false)}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Invisible edge strip */}
      {!sidebarOpen && (
        <div
          className="fixed left-0 top-0 h-full w-1 z-40"
          onMouseEnter={() => setSidebarOpen(true)}
        />
      )}

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-col min-h-screen">

        {/* ── Header ── */}
        <header className="sticky top-0 z-30 h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/60 shadow-sm flex items-center justify-between px-5 transition-colors duration-200">

          {/* Left: hamburger + brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <span className="text-slate-800 dark:text-slate-100 font-bold text-sm">Textile ERP</span>
              <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">·</span>
              <span className="text-slate-400 dark:text-slate-500 text-xs hidden sm:inline">Recycling System</span>
            </div>
          </div>

          {/* Right: dark toggle + role badge + user pill */}
          <div className="flex items-center gap-2">

            {/* 🌙 Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-yellow-300 transition-colors"
            >
              {darkMode ? (
                /* Sun icon */
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                /* Moon icon */
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

            {/* Role badge */}
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-400 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              <span className="text-xs font-medium capitalize">
                {user?.role?.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

            {/* User pill */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full pl-3 pr-1 py-1">
              <span className="text-slate-700 dark:text-slate-200 font-semibold text-sm hidden sm:block">
                {user?.username}
              </span>
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {user?.username?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>

          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 p-6">
          {children}
        </main>

      </div>
    </div>
  );
}
