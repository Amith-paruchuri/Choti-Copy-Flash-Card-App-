import { createClient } from "@/lib/supabase/client";
import { MAX_IMAGE_EDGE, MEDIA_BUCKET } from "@/lib/media/constants";

export interface CompressedImage {
  blob: Blob;
  mime: string;
  bytes: number;
  width: number;
  height: number;
}

const JPEG = "image/jpeg";
const WEBP = "image/webp";

function canEncodeWebp(): boolean {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    return c.toDataURL(WEBP).startsWith(`data:${WEBP}`);
  } catch {
    return false;
  }
}

function loadBitmap(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn’t a readable image."));
    };
    img.src = url;
  });
}

/**
 * Downscale (longest edge → {@link MAX_IMAGE_EDGE}) and re-encode a picked image
 * to WebP (or JPEG where WebP isn't supported) before it's hashed and uploaded,
 * so we never store a raw multi-megapixel camera photo. SVGs are passed through
 * untouched — rasterising them would lose the labels that make a diagram useful.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  if (file.type === "image/svg+xml") {
    const buf = await file.arrayBuffer();
    return {
      blob: file,
      mime: file.type,
      bytes: buf.byteLength,
      width: 0,
      height: 0,
    };
  }

  const img = await loadBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn’t process that image.");
  ctx.drawImage(img, 0, 0, width, height);

  const mime = canEncodeWebp() ? WEBP : JPEG;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, 0.82),
  );
  if (!blob) throw new Error("Couldn’t compress that image.");

  return { blob, mime, bytes: blob.size, width, height };
}

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface UploadedCardImage {
  path: string;
  hash: string;
  mime: string;
  bytes: number;
}

/**
 * Compress → content-hash → upload to `flashcard-media/<uid>/<hash>`. Identical
 * images land on the same key (dedup), so `upsert` is safe and cheap.
 */
export async function uploadCardImage(
  file: File,
  userId: string,
): Promise<UploadedCardImage> {
  const { blob, mime, bytes } = await compressImage(file);
  const hash = await sha256Hex(blob);
  const path = `${userId}/${hash}`;

  const supabase = createClient();
  // Content-addressed: an object at this key already holds these exact bytes,
  // so a duplicate upload is a success, not an error. `upsert: false` keeps us
  // on the INSERT storage policy (there's no UPDATE policy on the bucket).
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, { contentType: mime, upsert: false });
  if (error && !/exist|dupl|409/i.test(error.message)) {
    throw new Error(
      `Image upload failed: ${error.message}. Is the “${MEDIA_BUCKET}” storage bucket set up?`,
    );
  }
  return { path, hash, mime, bytes };
}

/** The signed-in user's id, read from the local session (no network round-trip). */
export async function currentUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  return session?.user.id ?? null;
}
