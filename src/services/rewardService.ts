
import { supabase } from "@/lib/supabase";
import { StoreItem, UserReward } from "@/types/supabase";

// Get all store items
export const getStoreItems = async (): Promise<StoreItem[]> => {
  try {
    const { data, error } = await supabase
      .from("store_items")
      .select("*")
      .eq("available", true)
      .order("token_cost", { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching store items:", error);
    return [];
  }
};

// Get user tokens
export const getUserTokens = async (userId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("tokens")
      .eq("id", userId)
      .single();

    if (error) throw error;
    return data.tokens || 0;
  } catch (error) {
    console.error("Error fetching user tokens:", error);
    return 0;
  }
};

// Redeem a reward
export const redeemReward = async (
  userId: string,
  itemId: string,
  tokenCost: number
): Promise<boolean> => {
  try {
    // First, check if the user has enough tokens
    const userTokens = await getUserTokens(userId);
    
    if (userTokens < tokenCost) {
      throw new Error("Not enough tokens to redeem this item");
    }

    // Begin a transaction
    const { data, error } = await supabase.rpc("redeem_item", {
      p_user_id: userId,
      p_item_id: itemId,
      p_token_cost: tokenCost
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error redeeming reward:", error);
    throw error;
  }
};

// Get user rewards
export const getUserRewards = async (userId: string): Promise<UserReward[]> => {
  try {
    const { data, error } = await supabase
      .from("user_rewards")
      .select(`
        *,
        item:item_id (*)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching user rewards:", error);
    return [];
  }
};

// For admin functions
export const getPendingRewards = async (): Promise<UserReward[]> => {
  try {
    const { data, error } = await supabase
      .from("user_rewards")
      .select(`
        *,
        item:item_id (*),
        user:user_id (*)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching pending rewards:", error);
    return [];
  }
};

// Update reward status (for admins)
export const updateRewardStatus = async (
  rewardId: string,
  status: "fulfilled" | "cancelled"
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("user_rewards")
      .update({ 
        status, 
        redemption_date: status === "fulfilled" ? new Date().toISOString() : null 
      })
      .eq("id", rewardId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error updating reward status:", error);
    return false;
  }
};
