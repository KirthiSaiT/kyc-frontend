"use client";

import { useState, useRef, useCallback, ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ShieldCheck, Fingerprint, CheckCircle2, Camera, Lock,
  Activity, RefreshCw, FileText, Shield, AlertTriangle,
  ChevronRight, XCircle, Clock, Hash, Eye, User, MapPin,
  CreditCard, Briefcase, Landmark, Info,
} from "lucide-react";
import Webcam from "react-webcam";
import Link from "next/link";

import { Button }  from "@/components/ui/button";
import { Input }   from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

// ── Schema ────────────────────────────────────────────────────────────────────

const formSchema = z.object({
  firstName:      z.string().min(2, "At least 2 characters."),
  lastName:       z.string().min(2, "At least 2 characters."),
  fathersName:    z.string().min(2, "At least 2 characters."),
  dateOfBirth:    z.string().refine(val => {
    const dob = new Date(val);
    const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return !isNaN(age) && age >= 18;
  }, "You must be at least 18 years old."),
  mobile:         z.string().length(10, "Must be exactly 10 digits.").regex(/^\d+$/, "Digits only."),
  address:        z.string().min(10, "Enter your full present address."),
  identityNumber: z
    .string()
    .length(12, "Must be exactly 12 digits.")
    .regex(/^\d+$/, "Digits only."),
  panNumber:      z
    .string()
    .length(10, "Must be exactly 10 characters.")
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i, "Invalid PAN. Format: ABCDE1234F"),
  occupation:     z.enum(["Salaried", "Self-employed", "Business", "Student", "Retired", "Homemaker", "Other"]),
  sourceOfFunds:  z.enum(["Salary", "Business income", "Savings", "Pension", "Investments", "Other"]),
});
type FormValues = z.infer<typeof formSchema>;

// ── Types ─────────────────────────────────────────────────────────────────────

interface RiskFactor { factor: string; weight: number; triggered: boolean; detail?: string; }
interface AuditEntry { time: string; eventType: string; payload: Record<string, unknown>; }
interface BlockchainAudit {
  txHash: string; blockNumber: number | null; contractAddress: string | null;
  network: string; live: boolean;
}
interface ZKPClaim { type: string; satisfied: boolean; }
interface ZKPCredential {
  credentialId: string; issuer: string; protocol: string; commitment: string;
  publicSignals: ZKPClaim[];
  proof: { R: string; challenge: string; response: string };
  verificationKey: string; issuedAt: string; expiresAt: string;
}
interface FederatedLog {
  time: string; node: string; event: string;
  latency_ms?: number; gradient_norm?: string; bundle_hash?: string;
  participating?: string[]; model_version?: string;
}
interface PKYCStatus {
  monitoringActive: boolean; status: string; nextReviewDate: string;
  triggerConditions: string[];
  behavioralBaseline: { establishedAt: string; deviceFingerprint: string; signals: string[] };
  reVerificationThreshold: number;
}
interface VerifyResult {
  status: string; zkpDid: string; sessionId: string;
  zkpCredential?: ZKPCredential;
  riskScore: { score: number; status: string; factors: RiskFactor[] };
  fraudSignals: string[];
  ocrResult: { extractedName: string | null; ocrConfidence: number; nameMatchScore: number | null } | null;
  consentsCaptured: string[];
  auditTrail: AuditEntry[];
  federatedLogs: FederatedLog[];
  pKYC?: PKYCStatus;
  blockchainAudit: BlockchainAudit;
}

type Step = 1 | 2 | 3 | 4;
const STEP_LABELS = ["Consent", "Personal Details", "Liveness Check", "Result"];

// ── IOB brand colours (Tailwind arbitrary values) ─────────────────────────────
// Primary: #003087  Accent gold: #F7941D  Light bg: #F0F4F8

export default function Home() {
  const [step, setStep]           = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError]   = useState<string | null>(null);
  const [result, setResult]       = useState<VerifyResult | null>(null);

  const [consents, setConsents] = useState({
    dataProcessing: false, amlScreening: false, documentRetention: false,
  });

  const [documentFile, setDocumentFile]       = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const capture = useCallback(() => {
    const img = webcamRef.current?.getScreenshot();
    setImageSrc(img || null);
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "", lastName: "", fathersName: "", dateOfBirth: "",
      mobile: "", address: "", identityNumber: "", panNumber: "",
      occupation: "Salaried", sourceOfFunds: "Salary",
    },
  });

  function handleDocumentChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocumentFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setDocumentPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  const allConsented = consents.dataProcessing && consents.amlScreening && consents.documentRetention;

  async function onSubmit(values: FormValues) {
    if (!imageSrc) { setApiError("Please capture your photo first."); return; }
    setApiError(null);
    setIsLoading(true);
    setStep(4);
    try {
      const fd = new FormData();
      fd.append("firstName",      values.firstName);
      fd.append("lastName",       values.lastName);
      fd.append("fathersName",    values.fathersName);
      fd.append("dateOfBirth",    values.dateOfBirth);
      fd.append("mobile",         values.mobile);
      fd.append("address",        values.address);
      fd.append("identityNumber", values.identityNumber);
      fd.append("panNumber",      values.panNumber.toUpperCase());
      fd.append("occupation",     values.occupation);
      fd.append("sourceOfFunds",  values.sourceOfFunds);
      const selfieBlob = await fetch(imageSrc).then(r => r.blob());
      fd.append("image", selfieBlob, "selfie.jpg");
      if (documentFile) fd.append("document", documentFile, documentFile.name);
      const consentList: string[] = [];
      if (consents.dataProcessing)    consentList.push("DATA_PROCESSING");
      if (consents.amlScreening)      consentList.push("AML_SCREENING");
      if (consents.documentRetention) consentList.push("DOCUMENT_RETENTION");
      fd.append("consents", JSON.stringify(consentList));
      const response = await fetch("http://localhost:4000/api/onboard", { method: "POST", body: fd });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || "Verification failed");
      setResult(data);
    } catch (err: any) {
      setApiError(err.message || "Network error. Please try again.");
      setStep(3);
    } finally {
      setIsLoading(false);
    }
  }

  function reset() {
    form.reset();
    setStep(1); setImageSrc(null); setDocumentFile(null);
    setDocumentPreview(null); setResult(null); setApiError(null);
    setConsents({ dataProcessing: false, amlScreening: false, documentRetention: false });
  }

  // ── Shared layout shell ───────────────────────────────────────────────────

  function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F0F4F8" }}>
        {/* Top bank header */}
        <header style={{ backgroundColor: "#003087" }} className="shadow-md">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white shadow">
                <Landmark className="w-5 h-5" style={{ color: "#003087" }} />
              </div>
              <div>
                <div className="text-white font-bold text-lg leading-tight tracking-wide">
                  Indian Overseas Bank
                </div>
                <div className="text-xs leading-tight" style={{ color: "#F7941D" }}>
                  Good People to Grow With
                </div>
              </div>
            </div>
            {/* Right badges */}
            <div className="hidden sm:flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs text-blue-200">
                <Lock className="w-3 h-3" /> 256-bit SSL
              </span>
              <span className="text-xs bg-white/10 text-white px-2 py-0.5 rounded border border-white/20">
                RBI Regulated
              </span>
              <div className="flex gap-2 ml-2">
                <Link href="/admin" className="text-xs text-blue-200 hover:text-white border border-white/20 px-2 py-1 rounded transition-colors">
                  Admin
                </Link>
                <Link href="/verify" className="text-xs text-blue-200 hover:text-white border border-white/20 px-2 py-1 rounded transition-colors">
                  Verify DID
                </Link>
              </div>
            </div>
          </div>
          {/* Sub-header bar */}
          <div style={{ backgroundColor: "#002070" }} className="px-4 py-1.5">
            <div className="max-w-6xl mx-auto text-xs text-blue-300 font-medium tracking-wide">
              Digital KYC Onboarding — Savings Account Opening
            </div>
          </div>
        </header>

        {/* Body */}
        <main className="flex-1 flex flex-col items-center py-8 px-4">
          <div className={`w-full ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer style={{ backgroundColor: "#003087" }} className="mt-auto py-3 px-4">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-blue-300">
            <span>© 2025 Indian Overseas Bank. All rights reserved.</span>
            <span>Regulated by Reserve Bank of India · Member of DICGC</span>
          </div>
        </footer>
      </div>
    );
  }

  // ── Step progress bar ──────────────────────────────────────────────────────

  function StepBar() {
    return (
      <div className="mb-8">
        {/* Section title */}
        <div className="text-center mb-5">
          <h2 className="text-xl font-bold text-gray-800">KYC Account Opening</h2>
          <p className="text-sm text-gray-500 mt-1">Step {step} of 4 — {STEP_LABELS[step - 1]}</p>
        </div>
        {/* Steps */}
        <div className="flex items-center justify-center">
          {STEP_LABELS.map((label, i) => {
            const num    = (i + 1) as Step;
            const active = step === num;
            const done   = step > num;
            return (
              <div key={label} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
                    ${done   ? "border-green-600 bg-green-600 text-white"
                     : active ? "text-white border-transparent"
                     :          "bg-white border-gray-300 text-gray-400"}`}
                    style={active ? { backgroundColor: "#003087", borderColor: "#003087" } : {}}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : num}
                  </div>
                  <span className={`text-xs mt-1.5 font-medium whitespace-nowrap
                    ${active ? "text-blue-900" : done ? "text-green-700" : "text-gray-400"}`}
                    style={active ? { color: "#003087" } : {}}>
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`w-14 sm:w-20 h-0.5 mx-2 mb-5 transition-all
                    ${step > num ? "bg-green-500" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Reusable section heading ───────────────────────────────────────────────

  function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
    return (
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
        <div className="p-1.5 rounded" style={{ backgroundColor: "#E8EEF7" }}>
          <span style={{ color: "#003087" }}>{icon}</span>
        </div>
        <h3 className="font-semibold text-gray-700 text-sm tracking-wide uppercase">{title}</h3>
      </div>
    );
  }

  // ── Field label with required marker ─────────────────────────────────────

  function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
    return (
      <span className="text-sm font-medium text-gray-700">
        {children}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
    );
  }

  // ── Select styling ────────────────────────────────────────────────────────

  const selectCls = "flex h-10 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-transparent";

  // ── Status badge ──────────────────────────────────────────────────────────

  function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { bg: string; text: string; border: string }> = {
      APPROVED:      { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
      MANUAL_REVIEW: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
      REJECTED:      { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
    };
    const s = map[status] ?? { bg: "#F9FAFB", text: "#374151", border: "#E5E7EB" };
    const icon: Record<string, React.ReactNode> = {
      APPROVED:      <CheckCircle2 className="w-3.5 h-3.5" />,
      MANUAL_REVIEW: <AlertTriangle className="w-3.5 h-3.5" />,
      REJECTED:      <XCircle className="w-3.5 h-3.5" />,
    };
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold"
        style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}>
        {icon[status]} {status.replace("_", " ")}
      </span>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1 — Consent
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 1) return (
    <Shell>
      <StepBar />
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Card top band */}
        <div className="px-6 py-4 border-b border-gray-100" style={{ backgroundColor: "#F7F9FC" }}>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: "#003087" }} />
            <h2 className="font-bold text-gray-800">Consent Declaration</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            As per RBI Master Direction on KYC (2016), your explicit consent is required before processing identity data.
            All three consents are mandatory.
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {[
            {
              key:   "dataProcessing" as const,
              icon:  <FileText className="w-4 h-4" />,
              label: "I consent to processing of personal data for KYC",
              desc:  "Your identity details will be processed to verify your identity and open your account. Data is encrypted at rest (AES-256-GCM) and protected in accordance with Information Technology Act, 2000.",
              ref:   "RBI KYC Master Direction, 2016 — Clause 16",
            },
            {
              key:   "amlScreening" as const,
              icon:  <Eye className="w-4 h-4" />,
              label: "I consent to Anti-Money Laundering (AML) screening",
              desc:  "Your details will be screened against RBI-mandated watchlists, UNSC sanctions lists, and PEP databases as required under Prevention of Money Laundering Act (PMLA), 2002.",
              ref:   "PMLA 2002 · RBI AML/CFT Guidelines",
            },
            {
              key:   "documentRetention" as const,
              icon:  <Lock className="w-4 h-4" />,
              label: "I consent to document retention for 7 years",
              desc:  "KYC documents and verification records shall be retained for a minimum of 5 years after account closure, and a minimum of 10 years for AML records, as mandated by RBI.",
              ref:   "RBI KYC Master Direction — Record Keeping Clause",
            },
          ].map(({ key, icon, label, desc, ref }) => (
            <label key={key}
              className={`flex gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all
                ${consents[key]
                  ? "border-blue-700 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"}`}>
              <input
                type="checkbox"
                checked={consents[key]}
                onChange={e => setConsents(prev => ({ ...prev, [key]: e.target.checked }))}
                className="mt-1 w-4 h-4 flex-shrink-0 accent-blue-700"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ color: "#003087" }}>{icon}</span>
                  <p className="font-semibold text-gray-800 text-sm">{label}</p>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                <p className="text-xs mt-1.5 font-mono" style={{ color: "#003087" }}>
                  Ref: {ref}
                </p>
              </div>
              {consents[key] && (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-700" />
              )}
            </label>
          ))}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Lock className="w-3 h-3" />
            <span>Consent records hashed and logged on blockchain for audit</span>
          </div>
          <Button
            onClick={() => setStep(2)}
            disabled={!allConsented}
            className="px-8 text-white font-semibold"
            style={{ backgroundColor: allConsented ? "#003087" : undefined }}
          >
            Proceed <ChevronRight className="ml-1 w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Info note */}
      <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
        <span>
          <strong>Fully Digital KYC</strong> — This process is powered by TrustGate ZKP Protocol. Your Aadhaar number
          is never stored in plaintext. A Zero-Knowledge Proof credential is issued on completion.
        </span>
      </div>
    </Shell>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2 — Personal Details
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 2) return (
    <Shell>
      <StepBar />
      <Form {...form}>
        <form id="identity-form" className="space-y-5">

          {/* Personal Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <SectionHeading icon={<User className="w-4 h-4" />} title="Personal Information" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField name="firstName" render={({ field }) => (
                  <FormItem>
                    <FormLabel><FieldLabel required>First Name</FieldLabel></FormLabel>
                    <FormControl>
                      <Input placeholder="Priya" className="border-gray-300 focus:border-blue-700 focus:ring-blue-700" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="lastName" render={({ field }) => (
                  <FormItem>
                    <FormLabel><FieldLabel required>Last Name / Surname</FieldLabel></FormLabel>
                    <FormControl>
                      <Input placeholder="Sharma" className="border-gray-300 focus:border-blue-700 focus:ring-blue-700" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField name="fathersName" render={({ field }) => (
                <FormItem>
                  <FormLabel><FieldLabel required>Father's / Guardian's Full Name</FieldLabel></FormLabel>
                  <FormControl>
                    <Input placeholder="Ramesh Kumar Sharma" className="border-gray-300 focus:border-blue-700 focus:ring-blue-700" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField name="dateOfBirth" render={({ field }) => (
                  <FormItem>
                    <FormLabel><FieldLabel required>Date of Birth</FieldLabel></FormLabel>
                    <FormControl>
                      <Input type="date" className="border-gray-300 focus:border-blue-700 focus:ring-blue-700" {...field} />
                    </FormControl>
                    <FormDescription>Applicant must be 18 years or older (RBI mandate).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="mobile" render={({ field }) => (
                  <FormItem>
                    <FormLabel><FieldLabel required>Mobile Number</FieldLabel></FormLabel>
                    <FormControl>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">+91</span>
                        <Input placeholder="9876543210" maxLength={10}
                          className="rounded-l-none border-gray-300 focus:border-blue-700 focus:ring-blue-700" {...field} />
                      </div>
                    </FormControl>
                    <FormDescription>Linked to your Aadhaar for eKYC OTP.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <SectionHeading icon={<MapPin className="w-4 h-4" />} title="Present Address" />
            <FormField name="address" render={({ field }) => (
              <FormItem>
                <FormLabel><FieldLabel required>Full Present Address</FieldLabel></FormLabel>
                <FormControl>
                  <Input
                    placeholder="Flat No., Building, Street, City, State – PIN Code"
                    className="border-gray-300 focus:border-blue-700 focus:ring-blue-700"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Enter your current residential address as it appears on your OVD (Officially Valid Document).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          {/* Identity Documents */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <SectionHeading icon={<CreditCard className="w-4 h-4" />} title="Identity Documents (OVD)" />
            <div className="grid grid-cols-2 gap-4">
              <FormField name="identityNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel><FieldLabel required>Aadhaar Number</FieldLabel></FormLabel>
                  <FormControl>
                    <Input placeholder="XXXX XXXX XXXX" maxLength={12}
                      className="font-mono tracking-widest border-gray-300 focus:border-blue-700 focus:ring-blue-700"
                      {...field} />
                  </FormControl>
                  <FormDescription>12-digit UID. Verified via Verhoeff checksum.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="panNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel><FieldLabel required>PAN Number</FieldLabel></FormLabel>
                  <FormControl>
                    <Input placeholder="ABCDE1234F" maxLength={10}
                      className="font-mono tracking-widest uppercase border-gray-300 focus:border-blue-700 focus:ring-blue-700"
                      {...field}
                      onChange={e => field.onChange(e.target.value.toUpperCase())} />
                  </FormControl>
                  <FormDescription>Mandatory under Income Tax Act s.139A.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Document photo upload */}
            <div className="mt-5 space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <FileText className="w-4 h-4" style={{ color: "#003087" }} />
                Upload Identity Document Photo
                <span className="text-gray-400 font-normal text-xs">(optional — enables OCR name match)</span>
              </label>
              {!documentPreview ? (
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-blue-50 hover:border-blue-400 transition-colors">
                  <FileText className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-sm text-gray-500">Click to upload Aadhaar / PAN / Passport</span>
                  <span className="text-xs text-gray-400 mt-0.5">JPG, PNG · max 5 MB</span>
                  <input type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={handleDocumentChange} />
                </label>
              ) : (
                <div className="relative rounded-lg overflow-hidden border border-gray-300">
                  <img src={documentPreview} alt="document" className="w-full h-32 object-cover" />
                  <button type="button"
                    className="absolute top-2 right-2 bg-white rounded-full p-1 shadow hover:bg-gray-100"
                    onClick={() => { setDocumentFile(null); setDocumentPreview(null); }}>
                    <XCircle className="w-4 h-4 text-gray-600" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-3 py-1">
                    {documentFile?.name}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Financial Profile */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <SectionHeading icon={<Briefcase className="w-4 h-4" />} title="Financial Profile (CDD / AML)" />
            <div className="grid grid-cols-2 gap-4">
              <FormField name="occupation" render={({ field }) => (
                <FormItem>
                  <FormLabel><FieldLabel required>Occupation</FieldLabel></FormLabel>
                  <FormControl>
                    <select className={selectCls} {...field}>
                      {["Salaried","Self-employed","Business","Student","Retired","Homemaker","Other"].map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="sourceOfFunds" render={({ field }) => (
                <FormItem>
                  <FormLabel><FieldLabel required>Source of Funds</FieldLabel></FormLabel>
                  <FormControl>
                    <select className={selectCls} {...field}>
                      {["Salary","Business income","Savings","Pension","Investments","Other"].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-1">
            <Button type="button" variant="outline" onClick={() => setStep(1)}
              className="border-gray-300 text-gray-700 hover:bg-gray-50">
              ← Back
            </Button>
            <Button type="button" onClick={form.handleSubmit(() => setStep(3))}
              className="px-10 text-white font-semibold"
              style={{ backgroundColor: "#003087" }}>
              Continue <ChevronRight className="ml-1 w-4 h-4" />
            </Button>
          </div>
        </form>
      </Form>
    </Shell>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3 — Liveness
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 3) return (
    <Shell>
      <StepBar />
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100" style={{ backgroundColor: "#F7F9FC" }}>
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5" style={{ color: "#003087" }} />
            <h2 className="font-bold text-gray-800">Live Photo Verification</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Please look directly at the camera. Ensure your face is fully visible and well-lit.
            Remove glasses if possible.
          </p>
        </div>

        <div className="px-6 py-6 flex flex-col items-center gap-5">
          {/* Guidelines */}
          <div className="w-full max-w-md grid grid-cols-3 gap-2">
            {[
              { text: "Face fully visible", ok: true },
              { text: "Good lighting", ok: true },
              { text: "No glasses/hat", ok: true },
            ].map(g => (
              <div key={g.text} className="flex items-center gap-1.5 text-xs text-gray-600 bg-green-50 border border-green-200 rounded px-2 py-1.5">
                <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                {g.text}
              </div>
            ))}
          </div>

          {/* Camera */}
          <div className="w-full max-w-sm relative">
            <div className="aspect-square rounded-xl overflow-hidden border-2 border-gray-300 bg-gray-100 shadow-inner relative">
              {!imageSrc ? (
                <>
                  <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover"
                    videoConstraints={{ facingMode: "user", aspectRatio: 1 }} />
                  {/* Face guide overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-44 h-52 border-2 border-white/60 rounded-full" />
                  </div>
                </>
              ) : (
                <img src={imageSrc} alt="captured" className="w-full h-full object-cover" />
              )}
            </div>
            {/* Corner markers */}
            {!imageSrc && (
              <>
                <div className="absolute top-3 left-3 w-6 h-6 border-l-2 border-t-2 rounded-tl-sm" style={{ borderColor: "#003087" }} />
                <div className="absolute top-3 right-3 w-6 h-6 border-r-2 border-t-2 rounded-tr-sm" style={{ borderColor: "#003087" }} />
                <div className="absolute bottom-3 left-3 w-6 h-6 border-l-2 border-b-2 rounded-bl-sm" style={{ borderColor: "#003087" }} />
                <div className="absolute bottom-3 right-3 w-6 h-6 border-r-2 border-b-2 rounded-br-sm" style={{ borderColor: "#003087" }} />
              </>
            )}
          </div>

          {/* Buttons */}
          {!imageSrc ? (
            <Button onClick={capture} className="w-48 text-white font-semibold py-2.5"
              style={{ backgroundColor: "#003087" }}>
              <Camera className="mr-2 w-4 h-4" /> Capture Photo
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setImageSrc(null)} className="border-gray-300 text-gray-700">
                <RefreshCw className="mr-2 w-4 h-4" /> Retake
              </Button>
            </div>
          )}

          {imageSrc && (
            <div className="flex items-center gap-2 text-green-700 text-sm font-medium bg-green-50 px-5 py-2.5 rounded-lg border border-green-200">
              <CheckCircle2 className="w-4 h-4" /> Photo captured — ready for verification
            </div>
          )}

          {apiError && (
            <div className="w-full p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {apiError}
            </div>
          )}

          <p className="text-xs text-gray-400 text-center max-w-xs">
            Powered by MediaPipe FaceLandmarker (478 landmarks + 52 blendshapes). Your photo is
            used only for liveness scoring and is not stored permanently.
          </p>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <Button variant="outline" onClick={() => setStep(2)} className="border-gray-300 text-gray-700">
            ← Back
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={!imageSrc || isLoading}
            className="px-10 text-white font-semibold"
            style={{ backgroundColor: "#003087" }}>
            {isLoading
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Processing…</>
              : <>Submit Application <ChevronRight className="ml-1 w-4 h-4" /></>}
          </Button>
        </div>
      </div>
    </Shell>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4 — Loading
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading || !result) return (
    <Shell>
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        {/* Animated logo */}
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
          <div className="absolute inset-0 rounded-full border-4 border-t-blue-800 animate-spin" style={{ borderTopColor: "#003087" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Landmark className="w-8 h-8" style={{ color: "#003087" }} />
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-800">Processing Your Application</p>
          <p className="text-sm text-gray-500 mt-1">Please wait while we verify your identity</p>
        </div>
        {/* Pipeline steps */}
        <div className="bg-white border border-gray-200 rounded-lg px-6 py-4 space-y-2.5 w-full max-w-sm shadow-sm">
          {[
            { label: "Liveness & face detection",    icon: <Camera className="w-3.5 h-3.5" /> },
            { label: "Document OCR & name match",    icon: <FileText className="w-3.5 h-3.5" /> },
            { label: "Fraud graph query (Neo4j)",    icon: <Eye className="w-3.5 h-3.5" /> },
            { label: "Risk scoring & AML check",     icon: <ShieldCheck className="w-3.5 h-3.5" /> },
            { label: "ZKP credential issuance",      icon: <Lock className="w-3.5 h-3.5" /> },
            { label: "Blockchain audit logging",     icon: <Hash className="w-3.5 h-3.5" /> },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
              <div className="p-1 rounded-full" style={{ backgroundColor: "#E8EEF7", color: "#003087" }}>{s.icon}</div>
              <span>{s.label}</span>
              <div className="ml-auto w-4 h-4 border-2 border-blue-200 border-t-blue-700 rounded-full animate-spin"
                style={{ borderTopColor: "#003087", animationDelay: `${i * 0.15}s` }} />
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4 — Result Dashboard
  // ─────────────────────────────────────────────────────────────────────────

  const { riskScore, fraudSignals, ocrResult, auditTrail, blockchainAudit,
          zkpDid, consentsCaptured, zkpCredential, federatedLogs, pKYC } = result;

  const statusConfig = {
    APPROVED:      { bg: "#F0FDF4", border: "#16A34A", iconBg: "#DCFCE7", title: "Identity Verified — Credential Issued",       sub: "Your KYC is complete. A Zero-Knowledge Proof credential has been issued." },
    MANUAL_REVIEW: { bg: "#FFFBEB", border: "#D97706", iconBg: "#FEF3C7", title: "Application Under Manual Review",              sub: "Our officer will review your application within 2 working days." },
    REJECTED:      { bg: "#FEF2F2", border: "#DC2626", iconBg: "#FEE2E2", title: "Verification Could Not Be Completed",          sub: "Please visit your nearest IOB branch with original documents." },
  }[riskScore.status] ?? { bg: "#F9FAFB", border: "#6B7280", iconBg: "#F3F4F6", title: "Processing", sub: "" };

  return (
    <Shell wide>
      {/* Status banner */}
      <div className="rounded-xl overflow-hidden shadow-sm border mb-6"
        style={{ backgroundColor: statusConfig.bg, borderColor: statusConfig.border }}>
        <div className="px-6 py-5 flex items-center gap-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: statusConfig.iconBg }}>
            {riskScore.status === "APPROVED"
              ? <CheckCircle2 className="w-8 h-8 text-green-700" />
              : riskScore.status === "MANUAL_REVIEW"
              ? <AlertTriangle className="w-8 h-8 text-amber-600" />
              : <XCircle className="w-8 h-8 text-red-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">{statusConfig.title}</h2>
              <StatusBadge status={riskScore.status} />
            </div>
            <p className="text-sm text-gray-600 mt-1">{statusConfig.sub}</p>
            <p className="text-xs text-gray-400 mt-1 font-mono">Session ID: {result.sessionId}</p>
          </div>
          <div className="hidden md:flex flex-col items-end gap-1">
            <span className="text-3xl font-bold" style={{ color: "#003087" }}>{riskScore.score}</span>
            <span className="text-xs text-gray-500">Risk Score / 100</span>
          </div>
        </div>
        {/* Risk bar */}
        <div className="h-1.5 bg-gray-200">
          <div className="h-full transition-all"
            style={{
              width: `${riskScore.score}%`,
              backgroundColor: riskScore.score <= 30 ? "#16A34A" : riskScore.score <= 60 ? "#D97706" : "#DC2626",
            }} />
        </div>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">

        {/* Risk Factors */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ backgroundColor: "#F7F9FC" }}>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-sm text-gray-700">Risk Analysis</span>
            <span className="ml-auto text-xs font-mono text-gray-500">{riskScore.score}/100</span>
          </div>
          <div className="p-4 space-y-2.5">
            {riskScore.factors.map((f, i) => (
              <div key={i} className={`p-2.5 rounded-lg border text-xs ${f.triggered
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-green-50 border-green-200 text-green-800"}`}>
                <div className="flex items-start gap-2">
                  {f.triggered
                    ? <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5 text-red-600" />
                    : <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5 text-green-600" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold leading-tight">{f.factor}</div>
                    {f.detail && <div className="text-gray-500 mt-0.5 leading-tight">{f.detail}</div>}
                  </div>
                  {f.triggered && <span className="font-bold text-red-600 flex-shrink-0">+{f.weight}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ZKP Credential */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ backgroundColor: "#F7F9FC" }}>
            <Lock className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold text-sm text-gray-700">ZKP Credential</span>
            {zkpCredential && (
              <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-mono">
                {zkpCredential.protocol}
              </span>
            )}
          </div>
          <div className="p-4 space-y-3">
            {zkpCredential ? (
              <>
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-1.5 font-mono text-xs">
                  <div className="flex gap-2">
                    <span className="text-gray-400 flex-shrink-0">id</span>
                    <span className="text-indigo-700 break-all text-xs">{zkpCredential.credentialId.substring(0, 36)}…</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 flex-shrink-0">C</span>
                    <span className="text-purple-700 break-all">{zkpCredential.commitment.substring(0, 28)}…</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 flex-shrink-0">VK</span>
                    <span className="text-green-700 break-all">{zkpCredential.verificationKey.substring(0, 28)}…</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {zkpCredential.publicSignals.map(s => (
                    <span key={s.type}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-mono border
                        ${s.satisfied
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : "bg-gray-100 text-gray-400 border-gray-200 line-through"}`}>
                      {s.satisfied ? "✓" : "✗"} {s.type}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  Expires {new Date(zkpCredential.expiresAt).toLocaleDateString("en-IN")}
                  {" · "}{zkpCredential.issuer}
                </p>
              </>
            ) : (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 overflow-x-auto">
                <pre className="text-xs text-indigo-700 font-mono break-all whitespace-pre-wrap">{zkpDid}</pre>
              </div>
            )}
          </div>
        </div>

        {/* Blockchain Audit */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ backgroundColor: "#F7F9FC" }}>
            <Hash className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-sm text-gray-700">Blockchain Audit</span>
            <span className={`ml-auto w-2 h-2 rounded-full flex-shrink-0 ${blockchainAudit.live ? "bg-green-500" : "bg-amber-400"}`} />
          </div>
          <div className="p-4 space-y-3 font-mono text-xs">
            <div>
              <p className="text-gray-500 mb-0.5 font-sans text-xs">Network</p>
              <p className="text-gray-800 font-medium font-sans text-xs">{blockchainAudit.network}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-0.5">TX Hash</p>
              <p className="text-amber-700 break-all leading-relaxed">{blockchainAudit.txHash}</p>
            </div>
            {blockchainAudit.blockNumber && (
              <div>
                <p className="text-gray-500 mb-0.5">Block Number</p>
                <p className="text-blue-700">#{blockchainAudit.blockNumber}</p>
              </div>
            )}
            {blockchainAudit.contractAddress && (
              <div>
                <p className="text-gray-500 mb-0.5">Smart Contract</p>
                <p className="text-indigo-700 break-all">{blockchainAudit.contractAddress}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">

        {/* Federated Learning */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: "#F7F9FC" }}>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-600" />
              <span className="font-semibold text-sm text-gray-700">Federated Learning Network</span>
            </div>
            <span className="text-xs bg-cyan-50 text-cyan-700 border border-cyan-200 rounded px-2 py-0.5">
              FedAvg · DP ε=1.2
            </span>
          </div>
          <div className="p-4">
            {federatedLogs?.length > 0 ? (
              <div className="space-y-2 font-mono text-xs max-h-48 overflow-y-auto pr-1">
                {federatedLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 border-l-2 border-cyan-200 pl-3 py-0.5">
                    <span className="text-gray-400 flex-shrink-0 w-18 text-xs">
                      {new Date(log.time).toLocaleTimeString("en-IN")}
                    </span>
                    <div>
                      <span className="text-cyan-700 block text-xs truncate max-w-xs">{log.node}</span>
                      <span className="text-gray-600">{log.event}</span>
                    </div>
                    {log.latency_ms && <span className="ml-auto text-gray-400 flex-shrink-0">{log.latency_ms}ms</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No federated logs available.</p>
            )}
          </div>
        </div>

        {/* Audit Trail + Fraud Signals + pKYC */}
        <div className="space-y-5">

          {/* Fraud Signals */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ backgroundColor: "#F7F9FC" }}>
              <Eye className="w-4 h-4 text-purple-600" />
              <span className="font-semibold text-sm text-gray-700">Fraud Graph (Neo4j)</span>
            </div>
            <div className="p-4">
              {fraudSignals.length === 0 ? (
                <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                  <CheckCircle2 className="w-4 h-4" /> No fraud signals detected
                </div>
              ) : (
                <div className="space-y-2">
                  {fraudSignals.map((sig, i) => (
                    <div key={i} className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-1.5 text-xs text-red-700">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {sig}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Audit Trail */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ backgroundColor: "#F7F9FC" }}>
              <Clock className="w-4 h-4 text-green-600" />
              <span className="font-semibold text-sm text-gray-700">Audit Trail</span>
            </div>
            <div className="p-4 max-h-44 overflow-y-auto space-y-1.5">
              {auditTrail.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400 w-20 flex-shrink-0 font-mono">
                    {new Date(e.time).toLocaleTimeString("en-IN")}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-gray-600 font-mono">{e.eventType.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* pKYC + Consents row */}
      {(pKYC || consentsCaptured.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          {pKYC && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: "#F7F9FC" }}>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-violet-600" />
                  <span className="font-semibold text-sm text-gray-700">Perpetual KYC (pKYC)</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold
                  ${pKYC.status === "active"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                  {pKYC.status.toUpperCase()}
                </span>
              </div>
              <div className="p-4 space-y-2.5 text-sm">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500 text-xs">Next review date</span>
                  <span className="font-mono text-xs font-semibold text-gray-800">{pKYC.nextReviewDate}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500 text-xs">Re-verify trigger</span>
                  <span className="font-mono text-xs font-semibold text-gray-800">{pKYC.reVerificationThreshold}/100</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Monitoring triggers</p>
                  <div className="flex flex-wrap gap-1">
                    {pKYC.triggerConditions.map(c => (
                      <span key={c} className="bg-violet-50 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5 text-xs font-mono">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {consentsCaptured.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ backgroundColor: "#F7F9FC" }}>
                <Shield className="w-4 h-4 text-teal-600" />
                <span className="font-semibold text-sm text-gray-700">Captured Consents</span>
              </div>
              <div className="p-4 space-y-2.5">
                {consentsCaptured.map(c => (
                  <div key={c} className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium">{c.replace(/_/g, " ")}</span>
                  </div>
                ))}
                <p className="text-xs text-gray-400 flex items-center gap-1 pt-1">
                  <Lock className="w-3 h-3" /> Consent bundle hashed and logged on-chain
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* OCR result */}
      {ocrResult && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ backgroundColor: "#F7F9FC" }}>
            <FileText className="w-4 h-4 text-sky-600" />
            <span className="font-semibold text-sm text-gray-700">Document OCR Result</span>
          </div>
          <div className="p-4 grid grid-cols-3 gap-4 text-sm">
            <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-500 text-xs mb-1">Extracted Name</p>
              <p className="font-semibold text-gray-800">{ocrResult.extractedName ?? "—"}</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-500 text-xs mb-1">OCR Confidence</p>
              <p className="font-semibold text-gray-800">{((ocrResult.ocrConfidence ?? 0) * 100).toFixed(0)}%</p>
            </div>
            {ocrResult.nameMatchScore !== null && (
              <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-500 text-xs mb-1">Name Match</p>
                <p className={`font-bold ${(ocrResult.nameMatchScore ?? 0) >= 0.6 ? "text-green-700" : "text-red-600"}`}>
                  {((ocrResult.nameMatchScore ?? 0) * 100).toFixed(0)}%
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action */}
      <div className="flex justify-center pt-2">
        <Button variant="outline" onClick={reset}
          className="px-8 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">
          Start New Application
        </Button>
      </div>
    </Shell>
  );
}
