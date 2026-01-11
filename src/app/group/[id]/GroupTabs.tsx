"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function GroupTabs({ groupId }: { groupId: string }) {
  const pathname = usePathname();

  const tabs = [
    { label: "Overview", href: `/group/${groupId}` },
    { label: "Leaderboard", href: `/group/${groupId}/leaderboard` },
    { label: "Log", href: `/group/${groupId}/log` },
    { label: "Badges", href: `/group/${groupId}/badges` },
    { label: "Hikes", href: `/group/${groupId}/hikes` },
    { label: "Feed", href: `/group/${groupId}/feed` },
  ];

  const isActive = (href: string) => {
    // Exact match for overview
    if (href === `/group/${groupId}`) return pathname === href;
    // Prefix match for subroutes
    return pathname.startsWith(href);
  };

  return (
    <nav style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          padding: 8,
          border: "1px solid #eee",
          borderRadius: 12,
          background: "white",
        }}
      >
        {tabs.map((t) => {
          const active = isActive(t.href);
          return (
            <Link
              key={t.label}
              href={t.href}
              style={{
                whiteSpace: "nowrap",
                padding: "8px 12px",
                borderRadius: 10,
                border: active ? "1px solid #111" : "1px solid #ddd",
                background: active ? "#111" : "transparent",
                color: active ? "white" : "#111",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
        Tip: on mobile, swipe the tabs left/right.
      </div>
    </nav>
  );
}
