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

export type Database = {
  public: {
    Tables: {
      thoughts: {
        Row: Thought;
        Insert: ThoughtInsert;
        Update: ThoughtUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
