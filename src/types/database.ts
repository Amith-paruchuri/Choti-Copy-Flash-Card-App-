/**
 * Hand-maintained to match supabase/migrations/*.sql.
 * Regenerate later with:
 *   npx supabase gen types typescript --project-id nyxivqlpikoffdopfmei > src/types/database.ts
 */

export type SourceType = "typed" | "pasted" | "image";
export type ImportKind =
  | "image"
  | "pdf"
  | "text"
  | "zip"
  | "resort"
  | "anki";

/** An image attached to a flashcard, stored in the `flashcard-media` bucket. */
export interface FlashcardImage {
  path: string;
  hash: string;
  mime: string;
  /** AI-generated, keyword-dense description of the image, for search + quizzes. */
  alt?: string;
}
export type QuizFormat = "mcq" | "blank";
export type QuizStyle = "plain" | "vignette";
export type ReviewSource = "review" | "quiz";
export type QuizMode = "practice" | "exam";
export type QuizLimitKind = "overall" | "per_question";

/** One answered (or skipped) question, snapshotted into a finished quiz session. */
export interface QuizSessionEntry {
  questionId: string;
  cardId: string;
  subjectId: string;
  cardTitle: string | null;
  subjectName: string | null;
  subjectColor: string | null;
  format: QuizFormat;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  /** null when the question was skipped / timed out. */
  picked: string | null;
  correct: boolean;
}
export type SubscriptionTier =
  | "free"
  | "trialing"
  | "pro"
  | "past_due"
  | "canceled";
export type BillingProvider = "stripe" | "razorpay";
export type ImportStatus =
  | "pending"
  | "processing"
  | "ready"
  | "saved"
  | "error";

/** A parsed unit of work for the import step loop. */
export type ImportChunk =
  | { type: "text"; text: string }
  | { type: "image"; storage_path: string }
  | { type: "image_inline"; mime: string; data_b64: string };

export interface Database {
  public: {
    Tables: {
      subjects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          icon: string | null;
          parent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          icon?: string | null;
          parent_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subjects"]["Insert"]>;
        Relationships: [];
      };
      flashcards: {
        Row: {
          id: string;
          user_id: string;
          subject_id: string;
          content: string;
          title: string | null;
          subtitle: string | null;
          source_type: SourceType;
          images: FlashcardImage[];
          image_alt: string | null;
          mnemonic: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject_id: string;
          content: string;
          title?: string | null;
          images?: FlashcardImage[];
          image_alt?: string | null;
          subtitle?: string | null;
          source_type?: SourceType;
          mnemonic?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["flashcards"]["Insert"]>;
        Relationships: [];
      };
      quiz_questions: {
        Row: {
          id: string;
          user_id: string;
          flashcard_id: string;
          question_text: string;
          options: string[];
          correct_answer: string;
          explanation: string;
          format: QuizFormat;
          style: QuizStyle;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          flashcard_id: string;
          question_text: string;
          options: string[];
          correct_answer: string;
          explanation?: string;
          format?: QuizFormat;
          style?: QuizStyle;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quiz_questions"]["Insert"]>;
        Relationships: [];
      };
      card_memory: {
        Row: {
          user_id: string;
          flashcard_id: string;
          state: number;
          due: string;
          stability: number;
          difficulty: number;
          elapsed_days: number;
          scheduled_days: number;
          learning_steps: number;
          reps: number;
          lapses: number;
          last_review: string | null;
          suspended: boolean;
          suspended_at: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          flashcard_id: string;
          state?: number;
          due?: string;
          stability?: number;
          difficulty?: number;
          elapsed_days?: number;
          scheduled_days?: number;
          learning_steps?: number;
          reps?: number;
          lapses?: number;
          last_review?: string | null;
          suspended?: boolean;
          suspended_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["card_memory"]["Insert"]>;
        Relationships: [];
      };
      review_events: {
        Row: {
          id: string;
          user_id: string;
          flashcard_id: string;
          question_id: string | null;
          rating: number;
          source: ReviewSource;
          reviewed_at: string;
          log: unknown;
        };
        Insert: {
          id?: string;
          user_id: string;
          flashcard_id: string;
          question_id?: string | null;
          rating: number;
          source: ReviewSource;
          reviewed_at?: string;
          log?: unknown;
        };
        Update: Partial<Database["public"]["Tables"]["review_events"]["Insert"]>;
        Relationships: [];
      };
      media_objects: {
        Row: {
          user_id: string;
          content_hash: string;
          storage_path: string;
          mime: string;
          bytes: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          content_hash: string;
          storage_path: string;
          mime: string;
          bytes?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["media_objects"]["Insert"]>;
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          new_cards_per_day: number;
          daily_review_target: number | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          new_cards_per_day?: number;
          daily_review_target?: number | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_settings"]["Insert"]>;
        Relationships: [];
      };
      ai_usage_daily: {
        Row: {
          user_id: string;
          day: string;
          calls: number;
        };
        Insert: {
          user_id: string;
          day: string;
          calls?: number;
        };
        Update: Partial<Database["public"]["Tables"]["ai_usage_daily"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          user_id: string;
          subscription_tier: SubscriptionTier;
          billing_provider: BillingProvider | null;
          customer_id: string | null;
          subscription_id: string | null;
          current_period_end: string | null;
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          subscription_tier?: SubscriptionTier;
          billing_provider?: BillingProvider | null;
          customer_id?: string | null;
          subscription_id?: string | null;
          current_period_end?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      subscription_events: {
        Row: {
          id: string;
          provider: BillingProvider;
          event_id: string;
          event_type: string;
          user_id: string | null;
          payload: unknown;
          received_at: string;
        };
        Insert: {
          id?: string;
          provider: BillingProvider;
          event_id: string;
          event_type: string;
          user_id?: string | null;
          payload?: unknown;
          received_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["subscription_events"]["Insert"]
        >;
        Relationships: [];
      };
      imports: {
        Row: {
          id: string;
          user_id: string;
          kind: ImportKind;
          original_name: string;
          storage_path: string | null;
          status: ImportStatus;
          error: string | null;
          notes: string | null;
          chunks: ImportChunk[];
          total_chunks: number;
          done_chunks: number;
          truncated: boolean;
          /** Subjects a re-sort job drew its cards from (empty for file imports). */
          source_subject_ids: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: ImportKind;
          original_name: string;
          storage_path?: string | null;
          status?: ImportStatus;
          error?: string | null;
          notes?: string | null;
          chunks?: ImportChunk[];
          total_chunks?: number;
          done_chunks?: number;
          truncated?: boolean;
          source_subject_ids?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["imports"]["Insert"]>;
        Relationships: [];
      };
      import_cards: {
        Row: {
          id: string;
          import_id: string;
          user_id: string;
          title: string;
          subtitle: string;
          content: string;
          suggested_subject: string | null;
          suggested_path: string[];
          /** When set, committing MOVES this existing flashcard instead of inserting. */
          flashcard_id: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          import_id: string;
          user_id: string;
          title: string;
          subtitle?: string;
          content: string;
          suggested_subject?: string | null;
          suggested_path?: string[];
          flashcard_id?: string | null;
          position?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["import_cards"]["Insert"]>;
        Relationships: [];
      };
      flashcard_links: {
        Row: {
          user_id: string;
          flashcard_id: string;
          related_id: string;
          relation: string | null;
          source: "ai" | "manual";
          created_at: string;
        };
        Insert: {
          user_id: string;
          flashcard_id: string;
          related_id: string;
          relation?: string | null;
          source?: "ai" | "manual";
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["flashcard_links"]["Insert"]
        >;
        Relationships: [];
      };
      quiz_sessions: {
        Row: {
          id: string;
          user_id: string;
          mode: QuizMode;
          subject_ids: string[];
          scope_label: string;
          total: number;
          correct: number;
          answered: number;
          time_limit_s: number | null;
          limit_kind: QuizLimitKind | null;
          duration_s: number;
          items: QuizSessionEntry[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: QuizMode;
          subject_ids?: string[];
          scope_label?: string;
          total: number;
          correct?: number;
          answered?: number;
          time_limit_s?: number | null;
          limit_kind?: QuizLimitKind | null;
          duration_s?: number;
          items?: QuizSessionEntry[];
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quiz_sessions"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      flashcard_weight: {
        Row: { flashcard_id: string; user_id: string; weight: number };
        Relationships: [];
      };
    };
    Functions: {
      get_recall_cards: {
        Args: { p_limit?: number };
        Returns: Database["public"]["Tables"]["flashcards"]["Row"][];
      };
      record_ai_call: {
        Args: Record<string, never>;
        Returns: number;
      };
      /** Null return means not eligible — trial already used, or already pro. */
      start_trial: {
        Args: Record<string, never>;
        Returns: string | null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Subject = Database["public"]["Tables"]["subjects"]["Row"];
export type Flashcard = Database["public"]["Tables"]["flashcards"]["Row"];
export type QuizQuestion = Database["public"]["Tables"]["quiz_questions"]["Row"];
export type CardMemoryRow = Database["public"]["Tables"]["card_memory"]["Row"];
export type ReviewEvent = Database["public"]["Tables"]["review_events"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type QuizSession = Database["public"]["Tables"]["quiz_sessions"]["Row"];
export type Import = Database["public"]["Tables"]["imports"]["Row"];
export type ImportCard = Database["public"]["Tables"]["import_cards"]["Row"];
