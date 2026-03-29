"use client";

import { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ShieldAlert, Fingerprint, Building2, CheckCircle2, Camera, Lock, Activity, RefreshCw } from "lucide-react";
import Webcam from "react-webcam";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Form Validation Schema
const formSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters."),
  lastName: z.string().min(2, "Last name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  identityNumber: z
    .string()
    .min(12, "Identity Number must be 12 digits (Aadhaar).")
    .max(12, "Identity Number must be exactly 12 digits.")
    .regex(/^\d+$/, "Identity Number must contain only digits."),
});

// Zod Inference Type
type FormDataZod = z.infer<typeof formSchema>;

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Real-time Dashboard state
  const [zkpDid, setZkpDid] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [blockHash, setBlockHash] = useState<string | null>(null);

  // Webcam Integration
  const webcamRef = useRef<Webcam>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const capture = useCallback(() => {
    const image = webcamRef.current?.getScreenshot();
    setImageSrc(image || null);
  }, [webcamRef]);

  const form = useForm<FormDataZod>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      identityNumber: "",
    },
  });

  async function onSubmit(values: FormDataZod) {
    if (!imageSrc) {
      setApiError("Please capture an image to proceed with Liveness Verification.");
      return;
    }

    setApiError(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("firstName", values.firstName);
      formData.append("lastName", values.lastName);
      formData.append("email", values.email);
      formData.append("identityNumber", values.identityNumber);
      
      // Convert standard Base64 DataURI to a Blob before sending to Multer
      const resDataUri = await fetch(imageSrc);
      const blob = await resDataUri.blob();
      formData.append("image", blob, `photocapture.jpg`);

      const response = await fetch("http://localhost:4000/api/onboard", {
        method: "POST",
        body: formData,
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Verification Failed");
      }

      // Success State Update
      setZkpDid(data.zkpDid);
      setAuditLogs(data.federatedLogs);
      setBlockHash(data.blockchainAudit.blockHash);
      setIsSuccess(true);
    } catch (error: any) {
      console.error(error);
      setApiError(error.message || "Network Error connecting to TrustGate orchestrator.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl space-y-6">
          <div className="flex items-center space-x-3 text-zinc-100 justify-center mb-8">
            <Building2 className="w-8 h-8 text-emerald-500" />
            <h1 className="text-3xl font-bold tracking-tight">TrustGate Verifier Node</h1>
          </div>

          <Card className="border-t-4 border-emerald-500 shadow-2xl bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader className="text-center pb-2 border-b border-zinc-800">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <CardTitle className="text-2xl font-semibold tracking-tight text-white">Identity Verified via AI</CardTitle>
              <CardDescription className="text-zinc-400">
                Your Zero-Knowledge Proof (ZKP) Decentralized ID block has been issued privately.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Crypto DID Token Box */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-zinc-300 font-semibold mb-2">
                  <Lock className="w-5 h-5 text-indigo-400" />
                  <span>Decentralized Identifier (DID)</span>
                </div>
                <div className="bg-zinc-950 p-4 rounded-md border border-zinc-800 overflow-x-auto">
                  <pre className="text-xs text-indigo-300/80 font-mono break-all whitespace-pre-wrap">
                    {zkpDid}
                  </pre>
                </div>
              </div>

              {/* Federated & Blockchain Logs */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-zinc-300 font-semibold mb-2">
                  <Activity className="w-5 h-5 text-amber-500" />
                  <span>Network Audit Stream</span>
                </div>
                <div className="bg-zinc-950 p-4 rounded-md border border-zinc-800 space-y-3 font-mono text-xs text-zinc-400">
                  {auditLogs.map((log: any, i: number) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-zinc-600">[{new Date(log.time).toLocaleTimeString()}]</span>
                      <span className="text-emerald-400/80">{log.event}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-zinc-900">
                    <span className="text-zinc-500 block">Hyperledger Commit Hash:</span>
                    <span className="text-amber-500/80 break-all">{blockHash}</span>
                  </div>
                </div>
              </div>

            </CardContent>
            <CardFooter className="flex justify-center pt-8 border-t border-zinc-800">
              <Button
                className="bg-zinc-800 hover:bg-zinc-700 text-white"
                onClick={() => {
                  form.reset();
                  setImageSrc(null);
                  setIsSuccess(false);
                }}
              >
                Start New Global Application
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center p-4 antialiased">
      <div className="w-full max-w-4xl mb-8 flex items-center justify-center space-x-3 text-slate-800">
        <Building2 className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">TrustGate Protocol</h1>
      </div>

      <Card className="w-full max-w-4xl border-t-4 border-t-primary shadow-xl bg-white">
        
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Form Side */}
          <div className="p-6 border-r border-zinc-100">
            <div className="space-y-1 pb-6 mb-6 border-b border-zinc-100">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-zinc-500" />
                <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">
                  Zero-Knowledge Onboarding
                </h2>
              </div>
              <p className="text-sm text-zinc-500">
                Pinging Federated Risk Enclaves...
              </p>
            </div>
          
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-zinc-700 font-semibold">First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John" className="bg-zinc-50 focus-visible:ring-primary" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-zinc-700 font-semibold">Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" className="bg-zinc-50 focus-visible:ring-primary" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-700 font-semibold">Email Address</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="john.doe@example.com"
                            className="bg-zinc-50 focus-visible:ring-primary"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="identityNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-700 font-semibold flex items-center gap-2">
                          <Fingerprint className="w-4 h-4" />
                          National Identity Number
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="XXXX XXXX XXXX"
                            maxLength={12}
                            className="bg-zinc-50 font-mono tracking-widest focus-visible:ring-primary"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>12-digit Government ID.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {apiError && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-md flex items-center gap-2 border border-red-100">
                    <ShieldAlert className="w-4 h-4"/>
                    {apiError}
                  </div>
                )}
                
                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full px-8 py-6 text-base font-semibold transition-all"
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Federated Inference Running...</span>
                      </div>
                    ) : (
                      "Provision Identity"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          {/* Camera Side */}
          <div className="p-6 bg-zinc-50 flex flex-col items-center justify-center">
             <div className="w-full h-full flex flex-col">
                <div className="flex items-center space-x-2 pb-6 border-b border-zinc-200 mb-6">
                  <Camera className="w-5 h-5 text-zinc-500" />
                  <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">
                    Liveness Verification
                  </h2>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                  <div className="w-full max-w-sm aspect-video bg-zinc-200 rounded-lg overflow-hidden border-2 border-dashed border-zinc-300 relative group flex items-center justify-center">
                    {!imageSrc ? (
                      <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        className="w-full h-full object-cover"
                        videoConstraints={{ facingMode: "user" }}
                      />
                    ) : (
                      <img src={imageSrc} alt="captured" className="w-full h-full object-cover" />
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {!imageSrc ? (
                      <Button onClick={capture} variant="default" className="w-40 shadow-sm">
                        Capture Photo
                      </Button>
                    ) : (
                      <Button onClick={() => setImageSrc(null)} variant="outline" className="w-40 border-zinc-300">
                        <RefreshCw className="mr-2 h-4 w-4" /> Retake 
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 text-center max-w-[200px] mt-2">
                    MediaPipe Anti-Spoofing active. Look directly at the camera.
                  </p>
                </div>
             </div>
          </div>
        </div>
      </Card>
      
      <div className="mt-8 text-sm text-zinc-400 font-medium">
        TrustGate Network • End-to-End Encrypted Node
      </div>
    </div>
  );
}
