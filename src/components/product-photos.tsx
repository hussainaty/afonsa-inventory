"use client";

import { Camera, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { deleteImageAction, makeMainImageAction } from "@/app/actions";
import { ActionButton } from "./forms/action-button";

const MAX_EDGE = 1600;

/** Shrinks a photo in the browser (≈150–400 KB) so storage stays small and uploads are fast. */
async function compress(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const toBlob = (type: string, q: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
  let blob = await toBlob("image/webp", 0.82);
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg", 0.85);
  if (!blob) throw new Error("Could not process this photo");
  return { blob, width, height };
}

export function ProductPhotos({
  productId,
  productName,
  images,
}: {
  productId: string;
  productName: string;
  images: { id: string }[];
}) {
  const router = useRouter();
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const current = images[Math.min(selected, images.length - 1)];

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, 12);
    try {
      for (const [i, file] of list.entries()) {
        setBusy(list.length > 1 ? `Uploading ${i + 1} of ${list.length}…` : "Uploading…");
        const form = new FormData();
        try {
          const { blob, width, height } = await compress(file);
          form.append("file", blob, blob.type === "image/webp" ? "photo.webp" : "photo.jpg");
          form.append("width", String(width));
          form.append("height", String(height));
        } catch {
          // The browser can't decode it (e.g. HEIC on Android/desktop): send the original if the server accepts it.
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            throw new Error(`“${file.name}” can't be read on this device. Use a JPEG or PNG photo.`);
          }
          form.append("file", file, file.name);
        }
        const res = await fetch(`/api/products/${productId}/images`, { method: "POST", body: form });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Upload failed");
        }
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
      if (pickRef.current) pickRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="photos-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id="photos-heading" className="section-title">Photos</h2>
        <div className="flex gap-2">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label="Take a photo"
            onChange={(e) => upload(e.target.files)}
          />
          <input
            ref={pickRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            className="sr-only"
            aria-label="Choose photos"
            onChange={(e) => upload(e.target.files)}
          />
          <button type="button" className="btn-secondary btn-sm sm:hidden" disabled={!!busy} onClick={() => cameraRef.current?.click()}>
            <Camera className="size-4" aria-hidden /> Camera
          </button>
          <button type="button" className="btn-secondary btn-sm" disabled={!!busy} onClick={() => pickRef.current?.click()}>
            <ImagePlus className="size-4" aria-hidden /> Add photos
          </button>
        </div>
      </div>

      {busy ? (
        <p role="status" className="flex items-center gap-2 px-4 pt-3 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {busy}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mx-4 mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      {images.length === 0 ? (
        <button
          type="button"
          onClick={() => pickRef.current?.click()}
          className="m-4 flex w-[calc(100%-2rem)] flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 py-10 text-center text-sm text-muted hover:bg-surface-2"
        >
          <ImagePlus className="size-7" aria-hidden />
          Add photos so similar parts (like 15″ vs 18″) are easy to tell apart.
        </button>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          <a
            href={`/api/images/${current.id}`}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-2xl bg-surface-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-gated image route */}
            <img
              src={`/api/images/${current.id}`}
              alt={`${productName} photo ${selected + 1}`}
              className="mx-auto max-h-[60vh] w-full object-contain"
            />
          </a>
          <div className="flex flex-wrap items-center gap-2">
            {current.id !== images[0].id ? (
              <ActionButton action={makeMainImageAction} fields={{ id: current.id }} className="btn-secondary btn-sm" showMessage={false}>
                <Star className="size-4" aria-hidden /> Make main photo
              </ActionButton>
            ) : (
              <span className="badge bg-accent-soft text-accent">
                <Star className="size-3" aria-hidden /> Main photo
              </span>
            )}
            <ActionButton
              action={deleteImageAction}
              fields={{ id: current.id }}
              className="btn-danger btn-sm"
              confirm="Delete this photo?"
              showMessage={false}
            >
              <Trash2 className="size-4" aria-hidden /> Delete
            </ActionButton>
          </div>
          {images.length > 1 ? (
            <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="All photos">
              {images.map((img, i) => (
                <li key={img.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-label={`Show photo ${i + 1}`}
                    aria-current={img.id === current.id}
                    className={`block size-16 overflow-hidden rounded-xl border-2 ${img.id === current.id ? "border-accent" : "border-transparent"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-gated image route */}
                    <img src={`/api/images/${img.id}`} alt="" className="size-full object-cover" loading="lazy" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
