// Hand-authored Supabase types for the tables used so far. Once a live project
// exists, regenerate the full set with:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
// Until then this covers `lead` (used by the corporate form).
//
// NOTE: these are `type` aliases, not `interface`s — the Supabase SDK constrains
// each table's Row/Insert/Update to `Record<string, unknown>`, which object-literal
// `type`s satisfy but `interface`s do not (interfaces lack an implicit index
// signature). Using `interface` here makes `.insert()` resolve to `never`.

export type LeadRow = {
  id: string;
  kind: 'corporate_rate' | 'room_block' | 'group' | 'general';
  company: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  rooms: number | null;
  nights: number | null;
  arrival: string | null; // ISO date
  notes: string | null;
  source_page: string | null;
  status: string;
  created_at: string;
};

export type LeadInsert = Omit<LeadRow, 'id' | 'status' | 'created_at'> & {
  status?: string;
};

export type Database = {
  public: {
    Tables: {
      lead: {
        Row: LeadRow;
        Insert: LeadInsert;
        Update: Partial<LeadInsert>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
