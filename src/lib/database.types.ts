export type ThoughtStatus = "inbox" | "developing" | "finished" | "archived";

export type Thought = {
  id: string;
  user_id: string;
  title: string | null;
  body: string;
  status: ThoughtStatus;
  is_pinned: boolean;
  review_at: string | null;
  created_at: string;
  updated_at: string;
  search_document?: unknown;
};

export type ThoughtInsert = {
  id?: string;
  user_id?: string;
  title?: string | null;
  body?: string;
  status?: ThoughtStatus;
  is_pinned?: boolean;
  review_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ThoughtUpdate = Partial<Omit<Thought, "search_document">>;

export type ThoughtVersionRow = {
  id: string;
  thought_id: string;
  user_id: string;
  title: string | null;
  body: string;
  created_at: string;
};

export type VoiceMemoRow = {
  id: string;
  thought_id: string;
  user_id: string;
  storage_path: string;
  duration_seconds: number;
  mime_type: string;
  created_at: string;
};

export type ThoughtShareRow = {
  id: string;
  user_id: string;
  thought_id: string;
  token: string;
  title: string | null;
  body: string;
  allow_comments: boolean;
  expires_at: string | null;
  created_at: string;
};

export type ShareCommentRow = {
  id: string;
  share_id: string;
  display_name: string;
  body: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      thoughts: {
        Row: Thought;
        Insert: ThoughtInsert;
        Update: ThoughtUpdate;
        Relationships: [];
      };
      thought_versions: {
        Row: ThoughtVersionRow;
        Insert: Omit<ThoughtVersionRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ThoughtVersionRow>;
        Relationships: [];
      };
      voice_memos: {
        Row: VoiceMemoRow;
        Insert: Omit<VoiceMemoRow, "created_at"> & { created_at?: string };
        Update: Partial<VoiceMemoRow>;
        Relationships: [];
      };
      thought_shares: {
        Row: ThoughtShareRow;
        Insert: Omit<ThoughtShareRow, "id" | "token" | "created_at"> & {
          id?: string;
          token?: string;
          created_at?: string;
        };
        Update: Partial<ThoughtShareRow>;
        Relationships: [];
      };
      share_comments: {
        Row: ShareCommentRow;
        Insert: Omit<ShareCommentRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ShareCommentRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_shared_thought: {
        Args: { p_share_token: string };
        Returns: Array<
          Pick<
            ThoughtShareRow,
            "id" | "title" | "body" | "allow_comments" | "expires_at"
          >
        >;
      };
      get_share_comments: {
        Args: { p_share_token: string };
        Returns: ShareCommentRow[];
      };
      add_share_comment: {
        Args: {
          p_share_token: string;
          p_display_name: string;
          p_body: string;
        };
        Returns: ShareCommentRow[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
