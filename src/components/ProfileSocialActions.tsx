"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export type DesignGiftItem = {
  id: string;
  title: string;
  designType: string;
  acquiredAt: string;
};

/**
 * Heart (friend) + mail (DM) for other logged-in viewers; gift icon for everyone.
 */
export default function ProfileSocialActions({
  profileUserId,
  username,
  isOwnProfile,
  initialIsFriend,
  initialCanAddFriend,
  designGifts = [],
}: {
  profileUserId: string;
  username: string;
  isOwnProfile?: boolean;
  initialIsFriend?: boolean;
  initialCanAddFriend?: boolean;
  designGifts?: DesignGiftItem[];
}) {
  const { data: session, status } = useSession();
  const myId = (session?.user as { id?: string } | undefined)?.id;
  const [steamId, setSteamId] = useState<string | null>(null);
  const [isFriend, setIsFriend] = useState(!!initialIsFriend);
  const [canAdd, setCanAdd] = useState(() => {
    if (initialIsFriend) return false;
    if (initialCanAddFriend === true) return true;
    if (initialCanAddFriend === false && initialIsFriend === false) return true;
    return initialCanAddFriend !== false;
  });
  const [busy, setBusy] = useState(false);
  const [giftsOpen, setGiftsOpen] = useState(false);

  useEffect(() => {
    if (myId) return;
    fetch("/api/me/session", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.userId) setSteamId(d.userId);
      })
      .catch(() => {});
  }, [myId]);

  const viewerId = myId || steamId;
  const ready = status !== "loading" || !!steamId || isOwnProfile;
  const showFriendMail = !isOwnProfile && ready && !!viewerId && viewerId !== profileUserId;

  useEffect(() => {
    if (!showFriendMail) return;
    fetch(`/api/friends/status?userId=${encodeURIComponent(profileUserId)}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setIsFriend(!!d.isFriend);
        setCanAdd(!!d.canAddFriend);
      })
      .catch(() => {});
  }, [showFriendMail, profileUserId]);

  async function addFriend() {
    setBusy(true);
    const res = await fetch("/api/friends/add", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username }),
    });
    setBusy(false);
    if (res.ok) {
      setIsFriend(true);
      setCanAdd(false);
    }
  }

  async function removeFriend() {
    if (!confirm("Remove friend?")) return;
    setBusy(true);
    const res = await fetch("/api/friends/remove", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ friendId: profileUserId }),
    });
    setBusy(false);
    if (res.ok) {
      setIsFriend(false);
      setCanAdd(true);
    }
  }

  return (
    <>
      <div className="tgSocial">
        {showFriendMail && canAdd ? (
          <button type="button" title="Add friend" disabled={busy} onClick={() => void addFriend()}>
            ♡
          </button>
        ) : null}
        {showFriendMail && isFriend ? (
          <button
            type="button"
            title="Remove friend"
            className="friended"
            disabled={busy}
            onClick={() => void removeFriend()}
          >
            ♥
          </button>
        ) : null}
        {showFriendMail ? (
          <Link href={`/dms/${profileUserId}`} title="Send message">
            ✉
          </Link>
        ) : null}
        <button
          type="button"
          title="Design gifts"
          onClick={() => setGiftsOpen(true)}
          aria-label="Design gifts"
        >
          🎁
        </button>
      </div>

      {giftsOpen ? (
        <div
          className="tgGiftsModal"
          role="dialog"
          aria-modal="true"
          aria-label="Design gifts"
          onClick={() => setGiftsOpen(false)}
        >
          <div className="tgGiftsPanel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <h2>Design gifts</h2>
              <button
                type="button"
                onClick={() => setGiftsOpen(false)}
                style={{
                  border: "1px solid #ccc",
                  background: "#fff",
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Close
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>
              Designs {username} has received ({designGifts.length})
            </div>
            {designGifts.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>No design gifts yet.</div>
            ) : (
              <div className="tgGiftsGrid">
                {designGifts.map((g) => (
                  <Link key={g.id} href={`/designs/${g.id}`} className="tgGiftCard" title={g.title}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/designs/${g.id}/image`} alt={g.title} />
                    <div style={{ marginTop: 6, fontWeight: 700 }}>{g.title}</div>
                    <div style={{ opacity: 0.65 }}>{g.designType.toLowerCase()}</div>
                    <div style={{ opacity: 0.55, marginTop: 2 }}>
                      {new Date(g.acquiredAt).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
