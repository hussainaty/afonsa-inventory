"use client";

import { Keyboard, Loader2, ScanLine, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { findByCodeAction } from "@/app/actions";

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts?: { formats?: string[] }) => Detector;

/**
 * Scans a barcode/QR with the camera (BarcodeDetector API, available on Android
 * Chrome and recent Safari) with a manual-entry fallback everywhere else.
 */
export function BarcodeScanner({ autoOpen = false }: { autoOpen?: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(autoOpen);
  const [status, setStatus] = useState<"idle" | "scanning" | "unsupported" | "denied" | "looking">("idle");
  const [manual, setManual] = useState("");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const resolve = useCallback(
    async (code: string) => {
      const value = code.trim();
      if (!value) return;
      stop();
      setStatus("looking");
      const id = await findByCodeAction(value).catch(() => null);
      setOpen(false);
      router.push(id ? `/products/${id}` : `/products/new?barcode=${encodeURIComponent(value)}`);
    },
    [router, stop],
  );

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    if (!open) {
      stop();
      return;
    }

    const Ctor = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    (async () => {
      if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setStatus("scanning");
        const detector = new Ctor();
        const tick = async () => {
          if (cancelled) return;
          try {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue) return void resolve(codes[0].rawValue);
          } catch {}
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch {
        setStatus("denied");
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stop();
    };
  }, [open, resolve, stop]);

  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        <ScanLine className="size-4" aria-hidden /> Scan
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        aria-label="Scan a barcode"
        className="m-auto w-[min(92vw,28rem)] rounded-3xl border border-border bg-surface p-0 text-text"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="section-title">Scan a barcode</h2>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Close scanner">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-4 p-5">
          {status !== "unsupported" ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
              <video ref={videoRef} className="size-full object-cover" playsInline muted />
              <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-accent/80" />
              {status === "looking" ? (
                <div className="absolute inset-0 grid place-items-center bg-black/50 text-white">
                  <Loader2 className="size-6 animate-spin" aria-label="Looking up product" />
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="text-sm text-muted" role="status">
            {status === "scanning" && "Point the camera at a barcode or QR code."}
            {status === "unsupported" && "Camera scanning isn't supported in this browser. Type the code instead."}
            {status === "denied" && "Camera access was blocked. Allow it in your browser settings, or type the code."}
            {status === "idle" && "Starting camera…"}
            {status === "looking" && "Looking up product…"}
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              resolve(manual);
            }}
          >
            <label htmlFor="manual-code" className="sr-only">
              Barcode or SKU
            </label>
            <input
              id="manual-code"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Barcode or SKU"
              className="input"
              maxLength={64}
              autoComplete="off"
            />
            <button type="submit" className="btn-primary" disabled={!manual.trim()}>
              <Keyboard className="size-4" aria-hidden /> Find
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
