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

// Adventure Pass member profile (M2). One row per auth user (user_id = auth.uid()),
// scoped to a destination. RLS `prof_own` (002) restricts read/write to own row;
// `authenticated` has CRUD via grant 004. Profile completion is optional and never
// blocks signup (ADR-006) — every field past user_id/destination_id is nullable or
// has a DB default.
export type MemberProfileRow = {
  user_id: string;
  destination_id: string;
  display_name: string | null;
  user_types: string[];
  interests: string[] | null;
  visit_reason: string | null;
  arrival_date: string | null; // ISO date
  departure_date: string | null; // ISO date
  member_since: string;
  marketing_optin: boolean;
  created_at: string;
};

// Insert requires only the two NOT-NULL-without-default columns; the rest default
// in Postgres (user_types → '{tourist}', marketing_optin → false, timestamps → now()).
export type MemberProfileInsert = Pick<MemberProfileRow, 'user_id' | 'destination_id'> &
  Partial<Omit<MemberProfileRow, 'user_id' | 'destination_id' | 'member_since' | 'created_at'>>;

// Destination — public reference table (RLS-free, SELECT-only for anon/auth via
// grant 004). Only the columns the app reads are typed precisely; `center`
// (PostGIS geography) is opaque to the client.
export type DestinationRow = {
  id: string;
  slug: string;
  name: string;
  center: unknown;
  timezone: string;
  config: Record<string, unknown> | null;
  created_at: string;
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
      destination: {
        Row: DestinationRow;
        Insert: DestinationRow;
        Update: Partial<DestinationRow>;
        Relationships: [];
      };
      member_profile: {
        Row: MemberProfileRow;
        Insert: MemberProfileInsert;
        Update: Partial<MemberProfileInsert>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
