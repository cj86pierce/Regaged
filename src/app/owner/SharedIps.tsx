"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export type IpGroup = {
  id?: string;
  source?: "ip" | "device";
  ip: string;
  accounts: {
    id: string; username: string; createdAt: string; lastSeenAt: string;
    firstLinkedAt: string; lastLinkedAt: string; loginCount: number | null;
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
  const [source, setSource] = useState("all");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (previewGroups) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/owner/shared-ips?page=${page}&search=${encodeURIComponent(search)}&source=${source}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load shared IPs.");
      setGroups(data.groups ?? []);
      setHasNext(!!data.hasNext);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load shared IPs.");
      setGroups([]);
      setHasNext(false);
    } finally { setBusy(false); }
  }, [page, search, source, previewGroups]);
  useEffect(() => { void load(); }, [load]);
  const visible = previewGroups ? groups.filter((group) => (source === "all" || (group.source ?? "ip") === source) && (group.ip.includes(search) || group.accounts.some((account) => account.username.toLowerCase().includes(search.toLowerCase())))) : groups;
  return <section className="ownerSection">
    <div className="ownerSectionHeading"><h2>Linked accounts</h2><button disabled={busy} onClick={() => void load()}>Refresh</button></div>
    <p className="ownerNote">Existing shared-device links and newly recorded shared IPs. A shared device or connection does not prove accounts belong to the same person. IP history starts from October 3, 2026.</p>
    <div className="ownerTabs" aria-label="Account link types">
      {[["all", "All links"], ["ip", "Shared IPs"], ["device", "Shared devices"]].map(([value, label]) => <button key={value} type="button" aria-pressed={source === value} onClick={() => { setPage(1); setSource(value); }}>{label}</button>)}
    </div>
    <form className="ownerToolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(query.trim()); }}>
      <input aria-label="Search username or IP" placeholder="Username or IP address" value={query} onChange={(event) => setQuery(event.target.value)} />
      <button disabled={busy}>Search</button>
      <label>Accounts ordered by <select value={sort} onChange={(event) => setSort(event.target.value)}>
        <option value="active">Last active</option><option value="newest">Newest account</option><option value="oldest">Oldest account</option><option value="logins">Logins on this IP</option><option value="games">Games played</option>
      </select></label>
    </form>
    {error && <p role="alert">{error}</p>}
    {busy && <p role="status">Loading shared IPs...</p>}
    {!busy && !error && !visible.length && <p>{source === "ip" ? "No shared IPs recorded yet. Existing device links are available under All links or Shared devices." : "No linked accounts found."}</p>}
    {visible.map((group) => <article className="ownerIpGroup" key={group.id ?? group.ip}>
      <header><strong>{group.source === "device" ? "Shared browser / device" : `Shared IP: ${group.ip}`}</strong><span>{group.accounts.length} accounts</span></header>
      <div className="ownerTableScroll"><table className="ownerIpTable">
        <thead><tr><th>Account</th><th>Joined</th><th>Last active</th><th>IP logins</th><th>Games</th><th>First / last linked</th><th><span className="ownerSrOnly">Actions</span></th></tr></thead>
        <tbody>{[...group.accounts].sort((a, b) => {
          if (sort === "logins") return (b.loginCount ?? 0) - (a.loginCount ?? 0);
          if (sort === "games") return b.gamesPlayed - a.gamesPlayed;
          if (sort === "newest") return Date.parse(b.createdAt) - Date.parse(a.createdAt);
          if (sort === "oldest") return Date.parse(a.createdAt) - Date.parse(b.createdAt);
          return Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
        }).map((account) => <tr key={account.id}>
          <td data-label="Account"><Link href={`/u/${encodeURIComponent(account.username.toLowerCase())}`}>{account.username}</Link><small>{account.banned ? "Banned" : account.warned ? "Warned" : "Active account"} · {account.karma} karma</small></td>
          <td data-label="Joined">{new Date(account.createdAt).toLocaleDateString()}</td>
          <td data-label="Last active">{new Date(account.lastSeenAt).toLocaleString()}</td>
          <td data-label="IP logins">{account.loginCount ?? "Not recorded"}</td>
          <td data-label="Games">{account.gamesPlayed}</td>
          <td data-label="Link history">{new Date(account.firstLinkedAt).toLocaleDateString()}<small>{new Date(account.lastLinkedAt).toLocaleString()}</small></td>
          <td><button onClick={() => onManage(account.username)}>Manage</button></td>
        </tr>)}</tbody>
      </table></div>
    </article>)}
    {!previewGroups && <div className="ownerToolbar"><button disabled={busy || page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button disabled={busy || !hasNext} onClick={() => setPage(page + 1)}>Next</button></div>}
  </section>;
}
