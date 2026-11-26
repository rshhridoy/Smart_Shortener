import { useEffect, useState } from 'react';
import { nanoid } from 'nanoid';
import { supabase } from '../lib/supabase';
import {
  Link2,
  Copy,
  Check,
  Trash2,
  Power,
  BarChart3,
  ExternalLink,
  LogOut,
  Plus,
} from 'lucide-react';

export default function DashboardPage({ session }) {
  const [links, setLinks] = useState([]);
  const [dailyClicks, setDailyClicks] = useState([]);
  const [originalUrl, setOriginalUrl] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const origin = window.location.origin;

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    const { data: linksData } = await supabase
      .from('links')
      .select('*')
      .order('created_at', { ascending: false });

    const userLinks = linksData || [];
    setLinks(userLinks);

    // Fetch last 7 days of clicks for chart
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const { data: clicksData } = await supabase
      .from('link_clicks')
      .select('clicked_at')
      .gte('clicked_at', sevenDaysAgo.toISOString());

    const countsByDay = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      countsByDay[key] = 0;
    }

    (clicksData || []).forEach((c) => {
      const key = new Date(c.clicked_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      if (key in countsByDay) countsByDay[key] += 1;
    });

    setDailyClicks(
      Object.entries(countsByDay).map(([date, count]) => ({ date, count }))
    );
  }

  async function handleCreateLink(e) {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      new URL(originalUrl.trim());
    } catch {
      setError('Enter a valid URL starting with http:// or https://');
      setCreating(false);
      return;
    }

    const slug = customSlug.trim().toLowerCase() || nanoid(6);
    if (!/^[a-z0-9-_]{3,30}$/.test(slug)) {
      setError('Custom alias must be 3–30 characters (letters, numbers, - or _)');
      setCreating(false);
      return;
    }

    const { error: insertError } = await supabase.from('links').insert({
      user_id: session.user.id,
      original_url: originalUrl.trim(),
      slug,
      title: title.trim() || originalUrl.trim(),
    });

    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'That custom alias is already taken.'
          : insertError.message
      );
    } else {
      setOriginalUrl('');
      setCustomSlug('');
      setTitle('');
      fetchDashboardData();
    }
    setCreating(false);
  }

  async function handleToggleActive(link) {
    await supabase
      .from('links')
      .update({ is_active: !link.is_active })
      .eq('id', link.id);
    fetchDashboardData();
  }

  async function handleDelete(id) {
    await supabase.from('links').delete().eq('id', id);
    fetchDashboardData();
  }

  function handleCopy(slug, id) {
    navigator.clipboard.writeText(`${origin}/s/${slug}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  }

  const totalClicks = links.reduce((sum, l) => sum + (l.clicks_count || 0), 0);
  const topLink = links.reduce(
    (best, curr) => ((curr.clicks_count || 0) > (best?.clicks_count || -1) ? curr : best),
    null
  );
  const maxDaily = Math.max(...dailyClicks.map((d) => d.count), 1);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-lg">
            <Link2 className="w-5 h-5" />
            <span>SnapLink Analytics</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500 hidden sm:inline">
              {session.user.email}
            </span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs text-slate-500 uppercase font-medium">Total Links</p>
            <p className="text-2xl font-bold mt-1">{links.length}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs text-slate-500 uppercase font-medium">Total Clicks</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{totalClicks}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs text-slate-500 uppercase font-medium">Top Performing Link</p>
            <p className="text-sm font-semibold mt-2 truncate">
              {topLink ? `/s/${topLink.slug} (${topLink.clicks_count} clicks)` : 'No links yet'}
            </p>
          </div>
        </div>

        {/* 7-Day Analytics Bar Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-4">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <span>Clicks Over Last 7 Days</span>
          </div>
          <div className="grid grid-cols-7 gap-3 items-end h-36 pt-4">
            {dailyClicks.map((day) => {
              const heightPercent = Math.round((day.count / maxDaily) * 100);
              return (
                <div key={day.date} className="flex flex-col items-center h-full justify-end">
                  <span className="text-xs font-medium text-slate-600 mb-1">{day.count}</span>
                  <div className="w-full max-w-[40px] bg-slate-100 rounded-t-md h-24 flex items-end">
                    <div
                      style={{ height: `${Math.max(heightPercent, day.count > 0 ? 12 : 4)}%` }}
                      className="w-full bg-indigo-600 rounded-t-md transition-all"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-2">{day.date}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Create Link Form */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Create New Short Link</h2>
          <form onSubmit={handleCreateLink} className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <input
              type="url"
              required
              placeholder="https://example.com/very-long-article-url"
              value={originalUrl}
              onChange={(e) => setOriginalUrl(e.target.value)}
              className="md:col-span-5 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="md:col-span-3 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="Custom alias (optional)"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value)}
              className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={creating}
              className="md:col-span-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {creating ? 'Saving...' : 'Shorten'}
            </button>
          </form>
          {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
        </div>

        {/* Links List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">Your Short Links</h2>
          </div>

          {links.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">
              No links created yet. Paste a URL above to create your first short link.
            </p>
          ) : (
            <div className="divide-y divide-slate-200">
              {links.map((link) => (
                <div
                  key={link.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/s/${link.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        {origin}/s/{link.slug}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          link.is_active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {link.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-1">{link.original_url}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                      {link.clicks_count} clicks
                    </span>

                    <button
                      onClick={() => handleCopy(link.slug, link.id)}
                      title="Copy short link"
                      className="p-2 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                    >
                      {copiedId === link.id ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => handleToggleActive(link)}
                      title={link.is_active ? 'Pause link' : 'Activate link'}
                      className="p-2 text-slate-500 hover:text-amber-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                    >
                      <Power className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(link.id)}
                      title="Delete link"
                      className="p-2 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
