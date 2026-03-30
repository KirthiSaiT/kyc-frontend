"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Lock, CheckCircle2, XCircle, Hash, Shield, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OnChainResult {
  isVerified:      boolean;
  verifierNode:    string;
  verifiedAt:      string | null;
  blockNumber:     number | null;
  contractAddress: string;
  didHash:         string;
}

interface VerifyResponse {
  valid:      boolean;
  claims:     string[];
  issuer:     string;
  issuedAt:   string;
  riskStatus: string;
  onChain:    OnChainResult | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VerifyPage() {
  const [token, setToken]   = useState("");
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res  = await fetch(`http://localhost:4000/api/verify-did?token=${encodeURIComponent(token.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const riskColour: Record<string, string> = {
    APPROVED:      "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    MANUAL_REVIEW: "bg-amber-500/20  text-amber-300  border-amber-500/40",
    REJECTED:      "bg-red-500/20    text-red-300    border-red-500/40",
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between text-zinc-100">
          <div className="flex items-center gap-3">
            <Building2 className="w-7 h-7 text-emerald-500" />
            <h1 className="text-2xl font-bold">DID Verifier</h1>
          </div>
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200 underline underline-offset-2">
            ← Onboarding
          </Link>
        </div>

        <p className="text-zinc-400 text-sm">
          Paste a TrustGate DID token to verify its cryptographic validity and check whether it was
          committed on-chain. This demonstrates <span className="text-white">reusable identity</span> —
          a credential issued at Bank A can be verified by Bank B without re-doing KYC.
        </p>

        {/* Input */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-400" /> Paste DID Token (JWT)
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Copy the token from the success dashboard after a completed KYC.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
              rows={4}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-xs font-mono text-indigo-300 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-600"
            />
            <Button onClick={handleVerify} disabled={!token.trim() || loading} className="w-full">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> Verifying…</>
                : "Verify Identity Credential"}
            </Button>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-500/30 rounded-lg text-red-300 text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">

            {/* Validity Banner */}
            <Card className={`border-t-4 ${result.valid ? "border-emerald-500" : "border-red-500"} bg-zinc-900 border-zinc-800`}>
              <CardHeader className="flex flex-row items-center gap-3 pb-3">
                {result.valid
                  ? <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  : <XCircle className="w-8 h-8 text-red-500" />}
                <div>
                  <CardTitle className="text-white text-base">
                    {result.valid ? "Valid credential — signature verified" : "Invalid credential"}
                  </CardTitle>
                  <CardDescription className="text-zinc-400 text-xs">
                    Issued by {result.issuer} · {new Date(result.issuedAt).toLocaleString()}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Claims */}
              <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-teal-400" /> Zero-Knowledge Claims
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.claims?.map(c => (
                    <div key={c} className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 rounded px-3 py-1.5 text-xs text-teal-300 font-mono">
                      <CheckCircle2 className="w-3 h-3" /> {c}
                    </div>
                  ))}
                  {result.riskStatus && (
                    <span className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full border text-xs font-semibold ${riskColour[result.riskStatus] ?? riskColour.APPROVED}`}>
                      <AlertTriangle className="w-3 h-3" /> Risk: {result.riskStatus.replace("_", " ")}
                    </span>
                  )}
                </CardContent>
              </Card>

              {/* On-chain proof */}
              <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Hash className="w-4 h-4 text-amber-400" /> On-Chain Proof
                  </CardTitle>
                </CardHeader>
                <CardContent className="font-mono text-xs space-y-2">
                  {result.onChain ? (
                    <>
                      <div className="flex items-center gap-2">
                        {result.onChain.isVerified
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          : <XCircle className="w-4 h-4 text-red-400" />}
                        <span className={result.onChain.isVerified ? "text-emerald-300" : "text-red-300"}>
                          {result.onChain.isVerified ? "Committed on-chain" : "Not found on-chain"}
                        </span>
                      </div>
                      {result.onChain.isVerified && (
                        <>
                          <div>
                            <span className="text-zinc-500 block">Verified At</span>
                            <span className="text-zinc-200">{result.onChain.verifiedAt}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">Block</span>
                            <span className="text-sky-400">#{result.onChain.blockNumber}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">DID Hash</span>
                            <span className="text-amber-400 break-all">{result.onChain.didHash}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">Contract</span>
                            <span className="text-indigo-400 break-all">{result.onChain.contractAddress}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">Verifier Node</span>
                            <span className="text-zinc-300 break-all">{result.onChain.verifierNode}</span>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="text-zinc-500">Blockchain offline — on-chain check unavailable</p>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
