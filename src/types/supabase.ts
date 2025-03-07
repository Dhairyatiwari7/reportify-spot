
export type HazardType = "pothole" | "waterlogging" | "other";
export type HazardStatus = "active" | "investigating" | "resolved";
export type RewardStatus = "pending" | "fulfilled" | "cancelled";

export interface Location {
  lat: number;
  lng: number;
  address: string;
}

export interface HazardReport {
  id: string;
  type: HazardType;
  description: string;
  location: Location;
  reported_by: string;
  reported_at: string;
  status: HazardStatus;
  votes: number;
  comments: number;
  image_url?: string;
  token_reward?: number;
}

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  token_cost: number;
  image_url?: string;
  available: boolean;
  created_at: string;
}

export interface UserReward {
  id: string;
  user_id: string;
  item_id: string;
  status: RewardStatus;
  redemption_date: string;
  created_at: string;
  item?: StoreItem;
}

export interface UserProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  tokens: number;
  is_admin: boolean;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          full_name: string;
          avatar_url: string | null;
          tokens: number;
          is_admin: boolean;
        };
        Insert: {
          id: string;
          created_at?: string;
          updated_at?: string;
          full_name: string;
          avatar_url?: string | null;
          tokens?: number;
          is_admin?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          full_name?: string;
          avatar_url?: string | null;
          tokens?: number;
          is_admin?: boolean;
        };
      };
      hazard_reports: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          type: HazardType;
          description: string;
          lat: number;
          lng: number;
          address: string;
          reported_by: string;
          status: HazardStatus;
          votes: number;
          comments: number;
          image_url: string | null;
          token_reward: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          type: HazardType;
          description: string;
          lat: number;
          lng: number;
          address: string;
          reported_by: string;
          status?: HazardStatus;
          votes?: number;
          comments?: number;
          image_url?: string | null;
          token_reward?: number;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          type?: HazardType;
          description?: string;
          lat?: number;
          lng?: number;
          address?: string;
          reported_by?: string;
          status?: HazardStatus;
          votes?: number;
          comments?: number;
          image_url?: string | null;
          token_reward?: number;
        };
      };
      hazard_votes: {
        Row: {
          id: string;
          created_at: string;
          hazard_id: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          hazard_id: string;
          user_id: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          hazard_id?: string;
          user_id?: string;
        };
      };
      hazard_comments: {
        Row: {
          id: string;
          created_at: string;
          hazard_id: string;
          user_id: string;
          content: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          hazard_id: string;
          user_id: string;
          content: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          hazard_id?: string;
          user_id?: string;
          content?: string;
        };
      };
      store_items: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          name: string;
          description: string;
          token_cost: number;
          image_url: string | null;
          available: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name: string;
          description: string;
          token_cost: number;
          image_url?: string | null;
          available?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name?: string;
          description?: string;
          token_cost?: number;
          image_url?: string | null;
          available?: boolean;
        };
      };
      user_rewards: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          item_id: string;
          status: RewardStatus;
          redemption_date: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          item_id: string;
          status?: RewardStatus;
          redemption_date?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          item_id?: string;
          status?: RewardStatus;
          redemption_date?: string;
        };
      };
    };
  };
}
