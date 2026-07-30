import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SharedThought } from "@/components/shared-thought";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "A thought shared from Still",
  description: "A private thought snapshot shared from Still.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SharedThoughtPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      token,
    )
  ) {
    notFound();
  }

  const { supabase } = await createSupabaseServerClient();
  const { data: shareRows } = await supabase.rpc("get_shared_thought", {
    p_share_token: token,
  });
  const share = shareRows?.[0];

  if (!share) {
    notFound();
  }

  const { data: comments } = share.allow_comments
    ? await supabase.rpc("get_share_comments", {
        p_share_token: token,
      })
    : { data: [] };

  return (
    <SharedThought
      shareToken={token}
      title={share.title}
      body={share.body}
      allowComments={share.allow_comments}
      initialComments={comments ?? []}
    />
  );
}
