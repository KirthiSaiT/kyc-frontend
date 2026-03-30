"use client";

import { useState, useRef, useCallback, ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ShieldAlert, Fingerprint, Building2, CheckCircle2, Camera, Lock,
  Activity, RefreshCw, FileText, Shield, AlertTriangle, Info,
  ChevronRight, XCircle, Clock, Hash, Eye,
} from "lucide-react";
import Webcam from "react-webcam";
import Link from "next/link";

import { Button }  from "@/components/ui/button";
import { Input }   from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

// ── Schema ────────────────────────────────────────────────────────────────────

const formSchema = z.object({
  firstName:      z.string().min(2, "At least 2 characters."),
  lastName:       z.string().min(2, "At least 2 characters."),
  email:          z.string().email("Enter a valid email."),
  identityNumber: z
    .string()
    .length(12, "Must be exactly 12 digits.")
    .regex(/^\d+$/, "Digits only."),
});
type FormValues = z.infer<typeof formSchema>;

// ── Types ─────────────────────────────────────────────────────────────────────

interface RiskFactor { factor: string; weight: number; triggered: boolean; detail?: string; }
interface AuditEntry { time: string; eventType: string; payload: Record<string, unknown>; }
interface BlockchainAudit {
  txHash: string; blockNumber: number | null; contractAddress: string | null;
  network: string; live: boolean;
}
interface VerifyResult {
  status: string; zkpDid: string; sessionId: string;
  riskScore: { score: number; status: string; factors: RiskFactor[] };
  fraudSignals: string[];
  ocrResult: { extractedName: string | null; ocrConfidence: number; nameMatchScore: number | null } | null;
  consentsCaptured: string[];
  auditTrail: AuditEntry[];
  blockchainAudit: BlockchainAudit;
}

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ["Consent", "Identity", "Liveness", "Result"];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [step, setStep]       = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError]   = useState<string | null>(null);
  const [result, setResult]       = useState<VerifyResult | null>(null);

  // Consents
  const [consents, setConsents] = useState({
    dataProcessing:    false,
    amlScreening:      false,
    documentRetention: false,
  });

  // Document upload
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);

  // Webcam
  const webcamRef = useRef<Webcam>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const capture = useCallback(() => {
    const img = webcamRef.current?.getScreenshot();
    setImageSrc(img || null);
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { firstName: "", lastName: "", email: "", identityNumber: "" },
  });

  // ── Document file handler ─────────────────────────────────────────────────

  function handleDocumentChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocumentFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setDocumentPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  // ── Consent gate ─────────────────────────────────────────────────────────

  const allConsented = consents.dataProcessing && consents.amlScreening && consents.documentRetention;

  // ── Submit ────────────────────────────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    if (!imageSrc) {
      setApiError("Please capture your photo in Step 3.");
      return;
    }
    setApiError(null);
    setIsLoading(true);
    setStep(4);

    try {
      const fd = new FormData();
      fd.append("firstName",      values.firstName);
      fd.append("lastName",       values.lastName);
      fd.append("email",          values.email);
      fd.append("identityNumber", values.identityNumber);

      // Selfie
      const selfieBlob = await fetch(imageSrc).then(r => r.blob());
      fd.append("image", selfieBlob, "selfie.jpg");

      // Document (optional)
      if (documentFile) fd.append("document", documentFile, documentFile.name);

      // Consents
      const consentList: string[] = [];
      if (consents.dataProcessing)    consentList.push("DATA_PROCESSING");
      if (consents.amlScreening)      consentList.push("AML_SCREENING");
      if (consents.documentRetention) consentList.push("DOCUMENT_RETENTION");
      fd.append("consents", JSON.stringify(consentList));

      const response = await fetch("http://localhost:4000/api/onboard", {
        method: "POST", body: fd,
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || data.details || "Verification failed");

      setResult(data);
    } catch (err: any) {
      setApiError(err.message || "Network error connecting to TrustGate gateway.");
      setStep(3);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function reset() {
    form.reset();
    setStep(1);
    setImageSrc(null);
    setDocumentFile(null);
    setDocumentPreview(null);
    setResult(null);
    setApiError(null);
    setConsents({ dataProcessing: false, amlScreening: false, documentRetention: false });
  }

  // ── Risk badge ────────────────────────────────────────────────────────────

  function RiskBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
      APPROVED:      "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      MANUAL_REVIEW: "bg-amber-500/20  text-amber-300  border-amber-500/40",
      REJECTED:      "bg-red-500/20    text-red-300    border-red-500/40",
    };
    const icon: Record<string, React.ReactNode> = {
      APPROVED:      <CheckCircle2 className="w-3 h-3" />,
      MANUAL_REVIEW: <AlertTriangle className="w-3 h-3" />,
      REJECTED:      <XCircle className="w-3 h-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${map[status] ?? "bg-zinc-700 text-zinc-300 border-zinc-600"}`}>
        {icon[status]} {status.replace("_", " ")}
      </span>
    );
  }

  // ── Stepper ───────────────────────────────────────────────────────────────

  function Stepper() {
    return (
      <div className="flex items-center justify-center gap-0 mb-8">
        {STEP_LABELS.map((label, i) => {
          const num     = (i + 1) as Step;
          const active  = step === num;
          const done    = step > num;
          return (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
                  ${done   ? "bg-emerald-500 border-emerald-500 text-white"
                   : active ? "bg-primary border-primary text-white"
                   :          "bg-zinc-100 border-zinc-300 text-zinc-400"}`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : num}
                </div>
                <span className={`text-xs mt-1 font-medium ${active ? "text-primary" : done ? "text-emerald-600" : "text-zinc-400"}`}>
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`w-16 h-0.5 mx-1 mb-4 ${step > num ? "bg-emerald-400" : "bg-zinc-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── STEP 1: Consent ───────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center p-4">
        <Header />
        <Card className="w-full max-w-2xl border-t-4 border-t-primary shadow-xl bg-white">
          <CardHeader className="pb-4">
            <Stepper />
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle className="text-xl">Data Processing Consent</CardTitle>
            </div>
            <CardDescription>
              TrustGate is required by RBI guidelines to obtain your explicit consent before processing any identity data.
              All three consents are mandatory to proceed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                key:   "dataProcessing" as const,
                label: "I consent to data processing for KYC purposes",
                desc:  "Your identity information will be processed to verify your identity and open your account. Data is encrypted at rest using AES-256 and never shared without your consent.",
              },
              {
                key:   "amlScreening" as const,
                label: "I consent to Anti-Money Laundering (AML) screening",
                desc:  "Your details will be checked against RBI-mandated watchlists and sanctions databases. This is a regulatory requirement under PMLA 2002.",
              },
              {
                key:   "documentRetention" as const,
                label: "I consent to document retention for 7 years",
                desc:  "As per RBI Master Direction on KYC, identity documents and verification records must be retained for a minimum of 7 years after account closure.",
              },
            ].map(({ key, label, desc }) => (
              <label key={key} className={`flex gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all
                ${consents[key] ? "border-primary bg-primary/5" : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"}`}>
                <input
                  type="checkbox"
                  checked={consents[key]}
                  onChange={e => setConsents(prev => ({ ...prev, [key]: e.target.checked }))}
                  className="mt-1 w-4 h-4 accent-primary flex-shrink-0"
                />
                <div>
                  <p className="font-semibold text-zinc-800 text-sm">{label}</p>
                  <p className="text-xs text-zinc-500 mt-1">{desc}</p>
                </div>
              </label>
            ))}
          </CardContent>
          <CardFooter className="flex justify-between items-center pt-4 border-t">
            <p className="text-xs text-zinc-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Consents are hashed and logged immutably on-chain
            </p>
            <Button onClick={() => setStep(2)} disabled={!allConsented} className="px-8">
              Continue <ChevronRight className="ml-1 w-4 h-4" />
            </Button>
          </CardFooter>
        </Card>
        <NavLinks />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── STEP 2: Identity + Document ───────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 2) {
    return (
      <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center p-4">
        <Header />
        <Card className="w-full max-w-2xl border-t-4 border-t-primary shadow-xl bg-white">
          <CardHeader className="pb-4">
            <Stepper />
            <div className="flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-primary" />
              <CardTitle className="text-xl">Identity Details & Document</CardTitle>
            </div>
            <CardDescription>Enter your details and upload your government-issued photo ID.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form id="identity-form" className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl><Input placeholder="Priya" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl><Input placeholder="Sharma" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl><Input type="email" placeholder="priya.sharma@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="identityNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Fingerprint className="w-4 h-4" /> Aadhaar Number
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="XXXX XXXX XXXX" maxLength={12}
                        className="font-mono tracking-widest" {...field} />
                    </FormControl>
                    <FormDescription>12-digit Aadhaar. Validated via Verhoeff checksum.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Document Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Identity Document Photo
                    <span className="text-zinc-400 font-normal text-xs">(optional — enables OCR name verification)</span>
                  </label>
                  {!documentPreview ? (
                    <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-zinc-300 rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 transition-colors">
                      <FileText className="w-6 h-6 text-zinc-400 mb-1" />
                      <span className="text-sm text-zinc-500">Click to upload Aadhaar / PAN / Passport</span>
                      <span className="text-xs text-zinc-400 mt-0.5">JPG, PNG, PDF · max 5MB</span>
                      <input type="file" accept="image/*,application/pdf" className="hidden"
                        onChange={handleDocumentChange} />
                    </label>
                  ) : (
                    <div className="relative rounded-lg overflow-hidden border border-zinc-200">
                      <img src={documentPreview} alt="document" className="w-full h-32 object-cover" />
                      <button type="button"
                        className="absolute top-2 right-2 bg-white rounded-full p-1 shadow hover:bg-zinc-100"
                        onClick={() => { setDocumentFile(null); setDocumentPreview(null); }}>
                        <XCircle className="w-4 h-4 text-zinc-600" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-3 py-1">
                        {documentFile?.name}
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-4">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={form.handleSubmit(() => setStep(3))} className="px-8">
              Continue <ChevronRight className="ml-1 w-4 h-4" />
            </Button>
          </CardFooter>
        </Card>
        <NavLinks />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── STEP 3: Liveness Capture ──────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 3) {
    return (
      <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center p-4">
        <Header />
        <Card className="w-full max-w-2xl border-t-4 border-t-primary shadow-xl bg-white">
          <CardHeader className="pb-4">
            <Stepper />
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              <CardTitle className="text-xl">Liveness Verification</CardTitle>
            </div>
            <CardDescription>
              Look directly at the camera in good lighting. Ensure your full face is visible.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="w-full max-w-sm aspect-video bg-zinc-200 rounded-xl overflow-hidden border-2 border-dashed border-zinc-300 relative">
              {!imageSrc ? (
                <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg"
                  className="w-full h-full object-cover"
                  videoConstraints={{ facingMode: "user" }} />
              ) : (
                <img src={imageSrc} alt="captured" className="w-full h-full object-cover" />
              )}
            </div>

            <div className="flex gap-3">
              {!imageSrc ? (
                <Button onClick={capture} className="w-40">
                  <Camera className="mr-2 w-4 h-4" /> Capture Photo
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setImageSrc(null)} className="w-40">
                  <RefreshCw className="mr-2 w-4 h-4" /> Retake
                </Button>
              )}
            </div>

            {imageSrc && (
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" /> Photo captured — ready to submit
              </div>
            )}

            {apiError && (
              <div className="w-full p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" /> {apiError}
              </div>
            )}

            <p className="text-xs text-zinc-400 text-center max-w-xs">
              OpenCV Haar Cascade face detection active. Ensure your face is well-lit and centred.
            </p>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-4">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={!imageSrc || isLoading} className="px-8">
              {isLoading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Processing…</>
                : <>Submit for Verification <ChevronRight className="ml-1 w-4 h-4" /></>}
            </Button>
          </CardFooter>
        </Card>
        <NavLinks />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── STEP 4: Result / Loading ──────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading || !result) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
          <p className="text-zinc-300 font-medium">Running TrustGate verification pipeline…</p>
          <div className="text-xs text-zinc-500 space-y-1">
            <p>Liveness check · Document OCR · Fraud graph · Risk scoring · Blockchain logging</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Success / Manual Review / Rejected Dashboard ──────────────────────────

  const { riskScore, fraudSignals, ocrResult, auditTrail, blockchainAudit, zkpDid, consentsCaptured } = result;
  const statusColour = riskScore.status === "APPROVED"
    ? "border-emerald-500"
    : riskScore.status === "MANUAL_REVIEW"
    ? "border-amber-500"
    : "border-red-500";

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center p-4 py-8">
      <div className="w-full max-w-5xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between text-zinc-100">
          <div className="flex items-center gap-3">
            <Building2 className="w-7 h-7 text-emerald-500" />
            <h1 className="text-2xl font-bold tracking-tight">TrustGate Verifier Node</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/verify" className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 px-3 py-1.5 rounded-md">
              Verify DID
            </Link>
            <Link href="/admin" className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 px-3 py-1.5 rounded-md">
              Admin
            </Link>
          </div>
        </div>

        {/* Status Banner */}
        <Card className={`border-t-4 ${statusColour} bg-zinc-900 border-zinc-800 text-zinc-100`}>
          <CardHeader className="flex flex-row items-center gap-4 pb-3">
            {riskScore.status === "APPROVED"
              ? <CheckCircle2 className="w-10 h-10 text-emerald-500 flex-shrink-0" />
              : riskScore.status === "MANUAL_REVIEW"
              ? <AlertTriangle className="w-10 h-10 text-amber-500 flex-shrink-0" />
              : <XCircle className="w-10 h-10 text-red-500 flex-shrink-0" />}
            <div>
              <CardTitle className="text-lg">
                {riskScore.status === "APPROVED"   && "Identity Verified — Credential Issued"}
                {riskScore.status === "MANUAL_REVIEW" && "Flagged for Manual Review"}
                {riskScore.status === "REJECTED"   && "Verification Rejected"}
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Risk score: <span className="font-bold text-white">{riskScore.score}/100</span> · Session {result.sessionId?.substring(0, 8)}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ZKP DID */}
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-zinc-300 font-semibold">
                <Lock className="w-4 h-4 text-indigo-400" /> Decentralised Identity (DID)
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-zinc-950 p-3 rounded-md border border-zinc-800 overflow-x-auto">
                <pre className="text-xs text-indigo-300/80 font-mono break-all whitespace-pre-wrap">{zkpDid}</pre>
              </div>
              <div className="flex flex-wrap gap-2">
                {["age_over_18", "aml_cleared", "liveness_verified"].map(claim => (
                  <span key={claim} className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full px-2 py-0.5 text-xs font-mono">
                    ✓ {claim}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Risk Score */}
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-zinc-300 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Risk Analysis
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-white">{riskScore.score}<span className="text-lg text-zinc-400">/100</span></span>
                <RiskBadge status={riskScore.status} />
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${riskScore.score <= 30 ? "bg-emerald-500" : riskScore.score <= 60 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${riskScore.score}%` }} />
              </div>
              <div className="space-y-2">
                {riskScore.factors.map((f, i) => (
                  <div key={i} className={`flex items-start gap-2 text-xs p-2 rounded ${f.triggered ? "bg-red-500/10 border border-red-500/20" : "bg-zinc-800/50"}`}>
                    {f.triggered
                      ? <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                      : <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />}
                    <div>
                      <span className={f.triggered ? "text-red-300" : "text-zinc-400"}>{f.factor}</span>
                      {f.detail && <span className="text-zinc-500 ml-1">— {f.detail}</span>}
                    </div>
                    {f.triggered && <span className="ml-auto text-red-400 font-bold flex-shrink-0">+{f.weight}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* OCR + Name Match */}
          {ocrResult && (
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-zinc-300 font-semibold">
                  <FileText className="w-4 h-4 text-sky-400" /> Document OCR
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Extracted name</span>
                  <span className="text-white font-mono">{ocrResult.extractedName ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">OCR confidence</span>
                  <span className="text-white">{((ocrResult.ocrConfidence ?? 0) * 100).toFixed(0)}%</span>
                </div>
                {ocrResult.nameMatchScore !== null && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Name match score</span>
                    <span className={`font-semibold ${(ocrResult.nameMatchScore ?? 0) >= 0.6 ? "text-emerald-400" : "text-red-400"}`}>
                      {((ocrResult.nameMatchScore ?? 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Fraud Signals */}
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-zinc-300 font-semibold">
                <Eye className="w-4 h-4 text-purple-400" /> Fraud Graph Signals
              </div>
            </CardHeader>
            <CardContent>
              {fraudSignals.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle2 className="w-4 h-4" /> No fraud signals detected in Neo4j graph
                </div>
              ) : (
                <div className="space-y-2">
                  {fraudSignals.map((sig, i) => (
                    <div key={i} className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded px-3 py-2 text-xs text-red-300">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {sig}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Blockchain Audit */}
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-zinc-300 font-semibold">
                <Hash className="w-4 h-4 text-amber-400" /> Blockchain Audit
              </div>
            </CardHeader>
            <CardContent className="space-y-2 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${blockchainAudit.live ? "bg-emerald-400" : "bg-amber-400"}`} />
                <span className="text-zinc-400">{blockchainAudit.network}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">TX Hash</span>
                <span className="text-amber-400 break-all">{blockchainAudit.txHash}</span>
              </div>
              {blockchainAudit.blockNumber && (
                <div>
                  <span className="text-zinc-500 block">Block</span>
                  <span className="text-sky-400">#{blockchainAudit.blockNumber}</span>
                </div>
              )}
              {blockchainAudit.contractAddress && (
                <div>
                  <span className="text-zinc-500 block">Contract</span>
                  <span className="text-indigo-400 break-all">{blockchainAudit.contractAddress}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Trail */}
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-zinc-300 font-semibold">
                <Activity className="w-4 h-4 text-emerald-400" /> Audit Trail
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {auditTrail.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Clock className="w-3 h-3 text-zinc-600 flex-shrink-0 mt-0.5" />
                    <span className="text-zinc-600">[{new Date(e.time).toLocaleTimeString()}]</span>
                    <span className="text-emerald-400/80">{e.eventType}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Consents */}
          {consentsCaptured.length > 0 && (
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-zinc-300 font-semibold">
                  <Shield className="w-4 h-4 text-teal-400" /> Captured Consents
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {consentsCaptured.map(c => (
                    <div key={c} className="flex items-center gap-2 text-xs text-teal-300">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{c.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                  <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Consent bundle hashed and logged on-chain
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        <div className="flex justify-center pt-2">
          <Button variant="outline" className="bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-white" onClick={reset}>
            Start New Verification
          </Button>
        </div>

      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Header() {
  return (
    <div className="w-full max-w-2xl mb-6 flex items-center justify-center gap-3 text-slate-800">
      <Building2 className="w-7 h-7 text-primary" />
      <h1 className="text-2xl font-bold tracking-tight">TrustGate Protocol</h1>
    </div>
  );
}

function NavLinks() {
  return (
    <div className="mt-6 flex gap-4 text-sm text-zinc-400">
      <Link href="/admin" className="hover:text-zinc-600 underline underline-offset-2">Admin Dashboard</Link>
      <Link href="/verify" className="hover:text-zinc-600 underline underline-offset-2">Verify DID</Link>
    </div>
  );
}
