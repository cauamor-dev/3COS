"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  return <Button variant="ghost" size="sm" onClick={() => {
    if (window.history.length > 1 && document.referrer && new URL(document.referrer).origin === window.location.origin) router.back();
    else router.push(fallback);
  }}><ArrowLeft />Voltar</Button>;
}
