import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.PUBLIC_SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

/**
 * Resizes photos in the browser before upload (max 1600px, WebP) so phone photos
 * don't eat the 1 GB free storage. SVG logos are uploaded as-is.
 */
async function prepareImage(file: File): Promise<{ blob: Blob; ext: string }> {
  if (file.type === 'image/svg+xml') return { blob: file, ext: 'svg' };
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.82));
  if (!blob) throw new Error('Imaginea nu a putut fi procesată.');
  return { blob, ext: 'webp' };
}

/** Uploads an image to the public `media` bucket and returns its public URL. */
export async function uploadImage(file: File, folder: string): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Fișierul ales nu este o imagine.');
  const { blob, ext } = await prepareImage(file);
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, blob, {
    contentType: ext === 'svg' ? 'image/svg+xml' : 'image/webp',
    cacheControl: '31536000',
  });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}
