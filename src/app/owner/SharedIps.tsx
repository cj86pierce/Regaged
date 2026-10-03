"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export type IpGroup = {
  ip: string;
  accounts: {
    id: string; username: string; createdAt: string; lastSeenAt: string;
    firstIpLoginAt: string; lastIpLoginAt: string; loginCount: number;
    gamesPlayed: number; karma: number; banned: boolean; warned: boolean;
  }[];
};

export default function SharedIps({ previewGroups, onManage }: {
  previewGroups?: IpGroup[]; onManage: (username: string) => void;
}) {
  const [groups, setGroups] = useState<IpGroup[]>(previewGroups ?? []);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("active");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (previewGroups) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/owner/shared-ips?page=${page}&search=${encodeURIComponent(search)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load shared IPs.");
      setGroups(data.groups ?? []);
      setHasNext(!!data.hasNext);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load shared IPs.");
      setGroups([]);
      setHasNext(false);
    } finally { setBusy(false); }
  }, [page, search, previewGroups]);
  useEffect(() => { void load(); }, [load]);
  const visible = previewGroups ? groups.filter((group) => group.ip.includes(search) || group.accounts.some((account) => account.username.toLowerCase().includes(search.toLowerCase()))) : groups;
  return <section className="ownerSection">
    <div className="ownerSectionHeading"><h2>Shared IPs</h2><button disabled={busy} onClick={() => void load()}>Refresh</button></div>
    <p className="ownerNote">Accounts with successful logins from the same IP. A shared connection does not prove accounts belong to the same person. History starts when IP tracking is enabled.</p>
    <form className="ownerToolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(query.trim()); }}>
      <input aria-label="Search username or IP" placeholder="Username or IP address" value={query} onChange={(event) => setQuery(event.target.value)} />
      <button disabled={busy}>Search</button>
      <label>Accounts ordered by <select value={sort} onChange={(event) => setSort(event.target.value)}>
        <option value="active">Last active</option><option value="newest">Newest account</option><option value="oldest">Oldest account</option><option value="logins">Logins on this IP</option><option value="games">Games played</option>
      </select></label>
    </form>
    {error && <p role="alert">{error}</p>}
    {busy && <p role="status">Loading shared IPs...</p>}
    {!busy && !error && !visible.length && <p>No shared IPs found.</p>}
    {visible.map((group) => <article className="ownerIpGroup" key={group.ip}>
      <header><strong>{group.ip}</strong><span>{group.accounts.length} accounts</span></header>
      <div className="ownerTableScroll"><table className="ownerIpTable">
        <thead><tr><th>Account</th><th>Joined</th><th>Last active</th><th>IP logins</th><th>Games</th><th>First / last IP login</th><th><span className="ownerSrOnly">Actions</span></th></tr></thead>
        <tbody>{[...group.accounts].sort((a, b) => {
          if (sort === "logins") return b.loginCount - a.loginCount;
          if (sort === "games") return b.gamesPlayed - a.gamesPlayed;
          if (sort === "newest") return Date.parse(b.createdAt) - Date.parse(a.createdAt);
          if (sort === "oldest") return Date.parse(a.createdAt) - Date.parse(b.createdAt);
          return Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
        }).map((account) => <tr key={account.id}>
          <td data-label="Account"><Link href={`/u/${encodeURIComponent(account.username.toLowerCase())}`}>{account.username}</Link><small>{account.banned ? "Banned" : account.warned ? "Warned" : "Active account"} · {account.karma} karma</small></td>
          <td data-label="Joined">{new Date(account.createdAt).toLocaleDateString()}</td>
          <td data-label="Last active">{new Date(account.lastSeenAt).toLocaleString()}</td>
          <td data-label="IP logins">{account.loginCount}</td>
          <td data-label="Games">{account.gamesPlayed}</td>
          <td data-label="IP history">{new Date(account.firstIpLoginAt).toLocaleDateString()}<small>{new Date(account.lastIpLoginAt).toLocaleString()}</small></td>
          <td><button onClick={() => onManage(account.username)}>Manage</button></td>
        </tr>)}</tbody>
      </table></div>
    </article>)}
    {!previewGroups && <div className="ownerToolbar"><button disabled={busy || page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button disabled={busy || !hasNext} onClick={() => setPage(page + 1)}>Next</button></div>}
  </section>;
}
