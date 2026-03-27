"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ShieldAlert, Fingerprint, Building2, CheckCircle2 } from "lucide-react";

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

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      identityNumber: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    // Simulate an API call to the kyc-gateway
    setTimeout(() => {
      console.log("Submitted payload:", values);
      setIsLoading(false);
      setIsSuccess(true);
    }, 2500);
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-t-4 border-t-primary shadow-lg">
          <CardHeader className="text-center pb-2">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
            <CardTitle className="text-2xl font-semibold tracking-tight">Identity Verified</CardTitle>
            <CardDescription className="text-base">
              Your information has been successfully securely transmitted to the Trust-Engine.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center pt-6">
            <Button
              variant="outline"
              onClick={() => {
                form.reset();
                setIsSuccess(false);
              }}
            >
              Start New Application
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center p-4 antialiased">
      <div className="w-full max-w-2xl mb-8 flex items-center justify-center space-x-3 text-slate-800">
        <Building2 className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">National Trust Bank</h1>
      </div>

      <Card className="w-full max-w-2xl border-t-4 border-t-primary shadow-xl bg-white">
        <CardHeader className="space-y-1 pb-6 border-b border-zinc-100">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-zinc-500" />
            <CardTitle className="text-xl font-semibold text-zinc-900 tracking-tight">
              Secure KYC Onboarding
            </CardTitle>
          </div>
          <CardDescription className="text-zinc-500 font-medium">
            Please enter your legal information exactly as it appears on your government-issued ID.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-700 font-semibold">Legal First Name</FormLabel>
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
                      <FormLabel className="text-zinc-700 font-semibold">Legal Last Name</FormLabel>
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
                    <FormDescription>
                      Your 12-digit Aadhaar or Social Security Number.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full md:w-auto px-8 py-6 text-base font-semibold transition-all"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Transmitting Securely...</span>
                    </div>
                  ) : (
                    "Authorize & Proceed"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      <div className="mt-8 text-sm text-zinc-400 font-medium">
        Encrypted Endpoint • 256-bit AES Security
      </div>
    </div>
  );
}
