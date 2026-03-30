"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2, RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  Hash, Users, ShieldAlert, Activity, Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Session {
  id: string; status: string; riskScore: number | null; riskStatus: string | null;
  livenessScore: number | null; fraudSignals: string[] | null;
  userName: string; email: string; blockchainTxHash: string | null;
  startedAt: string;
}

interface Stats {
  totalUsers: number;
  statusBreakdown: { APPROVED: number; REJECTED: number; MANUAL_REVIEW: number };
  pendingCount: number;
  totalOnChain: number;
  recentSessions: Session[];
  topRiskIPs: { ip: string; userCount: number }[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  async function fetchStats() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("http://localhost:4000/api/admin/stats");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch stats");
      setStats(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchStats(); }, []);

  async function updateStatus(sessionId: string, status: "APPROVED" | "REJECTED") {
    setUpdating(sessionId);
    try {
      const res = await fetch(`http://localhost:4000/api/admin/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchStats();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdating(null);
    }
  }

  function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
      APPROVED:      "bg-emerald-100 text-emerald-700 border border-emerald-200",
      MANUAL_REVIEW: "bg-amber-100  text-amber-700  border border-amber-200",
      REJECTED:      "bg-red-100    text-red-700    border border-red-200",
      PENDING:       "bg-zinc-100   text-zinc-500   border border-zinc-200",
    };
    const icon: Record<string, React.ReactNode> = {
      APPROVED:      <CheckCircle2 className="w-3 h-3" />,
      MANUAL_REVIEW: <AlertTriangle className="w-3 h-3" />,
      REJECTED:      <XCircle className="w-3 h-3" />,
      PENDING:       <Activity className="w-3 h-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? map.PENDING}`}>
        {icon[status] ?? icon.PENDING} {status.replace("_", " ")}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">TrustGate Admin</h1>
              <p className="text-sm text-zinc-500">Post-onboarding monitoring & manual review queue</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-700 underline underline-offset-2">
              ← Onboarding
            </Link>
            <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> {error}
            <span className="text-xs text-red-400 ml-2">— Is the gateway running on :4000?</span>
          </div>
        )}

        {loading && !stats && (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {stats && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Users",       value: stats.totalUsers,                       icon: <Users className="w-5 h-5 text-zinc-500" />,          colour: "text-zinc-900" },
                { label: "Approved",          value: stats.statusBreakdown.APPROVED,         icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, colour: "text-emerald-700" },
                { label: "Manual Review",     value: stats.statusBreakdown.MANUAL_REVIEW,   icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,  colour: "text-amber-700" },
                { label: "On-Chain Proofs",   value: stats.totalOnChain,                    icon: <Hash className="w-5 h-5 text-indigo-500" />,          colour: "text-indigo-700" },
              ].map(({ label, value, icon, colour }) => (
                <Card key={label} className="bg-white">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-400 font-medium">{label}</span>
                      {icon}
                    </div>
                    <p className={`text-3xl font-bold ${colour}`}>{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Sessions Table */}
              <div className="lg:col-span-2">
                <Card className="bg-white">
                  <CardHeader>
                    <CardTitle className="text-base">Recent KYC Sessions</CardTitle>
                    <CardDescription>Latest 20 verifications. Manual Review sessions can be actioned here.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-100 text-zinc-400 text-xs">
                            <th className="text-left pb-2 font-medium">User</th>
                            <th className="text-left pb-2 font-medium">Status</th>
                            <th className="text-left pb-2 font-medium">Risk</th>
                            <th className="text-left pb-2 font-medium">Chain</th>
                            <th className="text-left pb-2 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                          {stats.recentSessions.map(s => (
                            <tr key={s.id} className="hover:bg-zinc-50">
                              <td className="py-2 pr-3">
                                <p className="font-medium text-zinc-900">{s.userName || "—"}</p>
                                <p className="text-xs text-zinc-400">{s.email}</p>
                              </td>
                              <td className="py-2 pr-3">
                                <StatusBadge status={s.status} />
                              </td>
                              <td className="py-2 pr-3">
                                <span className={`font-bold text-sm ${(s.riskScore ?? 0) <= 30 ? "text-emerald-600" : (s.riskScore ?? 0) <= 60 ? "text-amber-600" : "text-red-600"}`}>
                                  {s.riskScore ?? "—"}
                                </span>
                              </td>
                              <td className="py-2 pr-3">
                                {s.blockchainTxHash
                                  ? <span className="text-xs text-indigo-500 font-mono">{s.blockchainTxHash.substring(0, 10)}…</span>
                                  : <span className="text-xs text-zinc-300">—</span>}
                              </td>
                              <td className="py-2">
                                {s.status === "MANUAL_REVIEW" && (
                                  <div className="flex gap-1">
                                    <button
                                      disabled={updating === s.id}
                                      onClick={() => updateStatus(s.id, "APPROVED")}
                                      className="text-xs px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded font-medium disabled:opacity-50">
                                      Approve
                                    </button>
                                    <button
                                      disabled={updating === s.id}
                                      onClick={() => updateStatus(s.id, "REJECTED")}
                                      className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded font-medium disabled:opacity-50">
                                      Reject
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                          {stats.recentSessions.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-zinc-400 text-sm">
                                No sessions yet — run an onboarding first.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right column */}
              <div className="space-y-4">

                {/* Status Breakdown */}
                <Card className="bg-white">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Status Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: "Approved",      value: stats.statusBreakdown.APPROVED,       colour: "bg-emerald-500" },
                      { label: "Manual Review", value: stats.statusBreakdown.MANUAL_REVIEW, colour: "bg-amber-500"   },
                      { label: "Rejected",      value: stats.statusBreakdown.REJECTED,       colour: "bg-red-500"     },
                      { label: "Pending",       value: stats.pendingCount,                   colour: "bg-zinc-300"    },
                    ].map(({ label, value, colour }) => (
                      <div key={label} className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${colour}`} />
                        <span className="text-sm text-zinc-600 flex-1">{label}</span>
                        <span className="font-bold text-zinc-900">{value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Top Risk IPs (Neo4j) */}
                <Card className="bg-white">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="w-4 h-4 text-purple-500" /> Fraud Graph — Risk IPs
                    </CardTitle>
                    <CardDescription className="text-xs">IPs linked to multiple identities (Neo4j)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {stats.topRiskIPs.length === 0 ? (
                      <p className="text-sm text-zinc-400">No suspicious IPs detected.</p>
                    ) : (
                      <div className="space-y-2">
                        {stats.topRiskIPs.map(({ ip, userCount }) => (
                          <div key={ip} className="flex items-center justify-between bg-red-50 border border-red-100 rounded px-3 py-2">
                            <span className="text-xs font-mono text-zinc-700">{ip}</span>
                            <span className="text-xs font-bold text-red-600">{userCount} identities</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
