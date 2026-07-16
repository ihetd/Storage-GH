"use client";

import { useCallback, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { getCroppedBlob, type PixelCrop } from "@/lib/cropImage";
import { btnPrimary, btnSecondary } from "@/components/ui";

type Status =
  | { kind: "idle" }
  | { kind: "cropping"; src: string }
  | { kind: "uploading" }
  | { kind: "error"; message: string };

export function ImageField({
  initialImageUrl,
  initialImageKey,
}: {
  initialImageUrl?: string | null;
  initialImageKey?: string | null;
}) {
  const [imageUrl, setImageUrl] = useState(initialImageUrl ?? "");
  const [imageKey, setImageKey] = useState(initialImageKey ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);

  // react-easy-crop state
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const croppedPixels = useRef<PixelCrop | null>(null);

  const onCropComplete = useCallback((_area: unknown, pixels: PixelCrop) => {
    croppedPixels.current = pixels;
  }, []);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setStatus({ kind: "cropping", src: String(reader.result) });
    };
    reader.readAsDataURL(file);
    // allow re-picking the same file later
    e.target.value = "";
  }

  async function confirmCrop() {
    if (status.kind !== "cropping" || !croppedPixels.current) return;
    const src = status.src;
    setStatus({ kind: "uploading" });
    try {
      const blob = await getCroppedBlob(src, croppedPixels.current);

      // 1) Ask the server for a presigned PUT URL.
      const presign = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: "image/jpeg" }),
      });

      if (presign.status === 503) {
        setStatus({
          kind: "error",
          message:
            "Image uploads aren't configured yet (Cloudflare R2). You can still save the product without a picture.",
        });
        return;
      }
      if (!presign.ok) {
        const d = (await presign.json().catch(() => ({}))) as {
          error?: string;
        };
        setStatus({ kind: "error", message: d.error || "Could not start upload." });
        return;
      }

      const { uploadUrl, imageKey: key, imageUrl: url } = (await presign.json()) as {
        uploadUrl: string;
        imageKey: string;
        imageUrl: string | null;
      };

      // 2) Upload the blob straight to R2.
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });
      if (!put.ok) {
        setStatus({ kind: "error", message: "Upload to storage failed." });
        return;
      }

      // 3) Stash key + url; they're saved with the product on form submit.
      setImageKey(key);
      // If no public base URL is configured, preview the local crop instead.
      setImageUrl(url || URL.createObjectURL(blob));
      setStatus({ kind: "idle" });
    } catch {
      setStatus({ kind: "error", message: "Could not process the image." });
    }
  }

  function cancelCrop() {
    setStatus({ kind: "idle" });
  }

  function removeImage() {
    setImageUrl("");
    setImageKey("");
    setStatus({ kind: "idle" });
  }

  return (
    <div>
      {/* Persisted with the product on submit */}
      <input type="hidden" name="imageUrl" value={imageUrl} />
      <input type="hidden" name="imageKey" value={imageKey} />

      <div className="flex items-start gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Product"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs text-slate-400">No image</span>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={btnSecondary}
            >
              {imageUrl ? "Replace image" : "Choose image"}
            </button>
            {imageUrl ? (
              <button
                type="button"
                onClick={removeImage}
                className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
              >
                Remove
              </button>
            ) : null}
          </div>
          <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">
            Optional. Crop & zoom before uploading. Works only once Cloudflare R2
            is configured; products save fine without a picture.
          </p>
          {status.kind === "uploading" ? (
            <p className="text-xs text-slate-500">Uploading…</p>
          ) : null}
          {status.kind === "error" ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {status.message}
            </p>
          ) : null}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onPick}
        className="hidden"
      />

      {status.kind === "cropping" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
              Crop image
            </h3>
            <div className="relative h-64 w-full overflow-hidden rounded-lg bg-slate-900">
              <Cropper
                image={status.src}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Zoom
              </label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={cancelCrop} className={btnSecondary}>
                Cancel
              </button>
              <button type="button" onClick={confirmCrop} className={btnPrimary}>
                Use image
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
