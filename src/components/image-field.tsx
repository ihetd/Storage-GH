"use client";

import { useCallback, useRef, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import type { CropperProps } from "react-easy-crop";
import { getCroppedBlob, type PixelCrop } from "@/lib/cropImage";
import { btnPrimary, btnSecondary } from "@/components/ui";

// react-easy-crop is a heavy dependency that's only needed once the user opens
// the crop dialog. Load it on demand so it stays out of the initial bundle for
// the (frequently visited) add/edit-product page. The cast keeps the library's
// defaultProps-based optional props optional (next/dynamic otherwise widens
// them all to required).
const Cropper = dynamic(
  () =>
    import("react-easy-crop").then(
      (m) => m.default as unknown as ComponentType<Partial<CropperProps>>,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-xs text-cream/50">
        Loading editor…
      </div>
    ),
  },
);

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
      // 1) Crop the image (canvas work) and ask the server for a presigned PUT
      // URL at the same time — neither depends on the other.
      const [blob, presign] = await Promise.all([
        getCroppedBlob(src, croppedPixels.current),
        fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: "image/jpeg" }),
        }),
      ]);

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
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-edge bg-raised">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Product"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs text-cream/40">No image</span>
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
                className="text-sm font-medium text-red-400 hover:underline"
              >
                Remove
              </button>
            ) : null}
          </div>
          <p className="max-w-xs text-xs text-cream/50">
            Optional. Crop & zoom before uploading. Works only once Cloudflare R2
            is configured; products save fine without a picture.
          </p>
          {status.kind === "uploading" ? (
            <p className="text-xs text-cream/50">Uploading…</p>
          ) : null}
          {status.kind === "error" ? (
            <p className="text-xs text-amber-400">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-edge bg-surface p-4 shadow-xl shadow-black/50">
            <h3 className="mb-3 text-sm font-semibold text-gold">Crop image</h3>
            <div className="relative h-64 w-full overflow-hidden rounded-lg bg-ink">
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
              <label className="mb-1 block text-xs font-medium text-cream/60">
                Zoom
              </label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-maroon"
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
