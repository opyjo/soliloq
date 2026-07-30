import type { AudioAttachment } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const BUCKET = "voice-memos";

export async function loadCloudAudioAttachments(
  userId: string,
  thoughtId: string,
): Promise<AudioAttachment[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("voice_memos")
    .select(
      "id,thought_id,user_id,storage_path,duration_seconds,mime_type,created_at",
    )
    .eq("thought_id", thoughtId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (memo) => {
      const { data: blob, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(memo.storage_path);
      if (downloadError) throw downloadError;
      return {
        id: memo.id,
        url: URL.createObjectURL(blob),
        blob,
        storagePath: memo.storage_path,
        synced: true,
        durationSeconds: memo.duration_seconds,
        createdAt: memo.created_at,
      } satisfies AudioAttachment;
    }),
  );
}

export async function syncAudioAttachment(
  userId: string,
  thoughtId: string,
  attachment: AudioAttachment,
) {
  if (!attachment.blob) {
    throw new Error("The voice memo has no audio data to sync.");
  }
  const supabase = getSupabaseBrowserClient();
  const extension = attachment.blob.type.includes("mp4")
    ? "m4a"
    : attachment.blob.type.includes("ogg")
      ? "ogg"
      : attachment.blob.type.includes("mpeg")
        ? "mp3"
        : "webm";
  const storagePath = `${userId}/${thoughtId}/${attachment.id}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, attachment.blob, {
      contentType: attachment.blob.type || "audio/webm",
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const { error: metadataError } = await supabase.from("voice_memos").upsert(
    {
      id: attachment.id,
      thought_id: thoughtId,
      user_id: userId,
      storage_path: storagePath,
      duration_seconds: attachment.durationSeconds,
      mime_type: attachment.blob.type || "audio/webm",
      created_at: attachment.createdAt,
    },
    { onConflict: "id" },
  );
  if (metadataError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw metadataError;
  }
  return { ...attachment, storagePath, synced: true };
}

export async function removeCloudAudioAttachment(
  userId: string,
  thoughtId: string,
  id: string,
  knownStoragePath?: string,
) {
  const supabase = getSupabaseBrowserClient();
  let storagePath = knownStoragePath;
  if (!storagePath) {
    const { data } = await supabase
      .from("voice_memos")
      .select("storage_path")
      .eq("id", id)
      .eq("thought_id", thoughtId)
      .eq("user_id", userId)
      .maybeSingle();
    storagePath = data?.storage_path;
  }
  const { error } = await supabase
    .from("voice_memos")
    .delete()
    .eq("id", id)
    .eq("thought_id", thoughtId)
    .eq("user_id", userId);
  if (error) throw error;
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([storagePath]);
    if (storageError) throw storageError;
  }
}

export async function removeCloudThoughtAudioAttachments(
  userId: string,
  thoughtId: string,
) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("voice_memos")
    .select("storage_path")
    .eq("thought_id", thoughtId)
    .eq("user_id", userId);
  if (error) throw error;
  const paths = (data ?? []).map((memo) => memo.storage_path);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove(paths);
    if (storageError) throw storageError;
  }
}
