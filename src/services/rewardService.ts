
import { supabase } from '@/lib/supabase';
import { StoreItem, UserReward, UserProfile } from '@/types/supabase';
import { toast } from 'sonner';

// Get user profile with token balance
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      full_name: data.full_name,
      avatar_url: data.avatar_url || undefined,
      tokens: data.tokens,
      is_admin: data.is_admin
    };
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    toast.error('Failed to load user profile');
    return null;
  }
};

// Get all store items
export const getStoreItems = async (): Promise<StoreItem[]> => {
  try {
    const { data, error } = await supabase
      .from('store_items')
      .select('*')
      .eq('available', true)
      .order('token_cost', { ascending: true });

    if (error) {
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('Error fetching store items:', error);
    toast.error('Failed to load store items');
    return [];
  }
};

// Redeem a store item
export const redeemStoreItem = async (userId: string, itemId: string): Promise<boolean> => {
  try {
    // Get the user profile to check token balance
    const profile = await getUserProfile(userId);
    
    if (!profile) {
      throw new Error('User profile not found');
    }
    
    // Get the item to check cost
    const { data: item, error: itemError } = await supabase
      .from('store_items')
      .select('*')
      .eq('id', itemId)
      .single();
      
    if (itemError || !item) {
      throw new Error('Item not found');
    }
    
    // Check if user has enough tokens
    if (profile.tokens < item.token_cost) {
      toast.error(`You need ${item.token_cost} tokens to redeem this item. You have ${profile.tokens} tokens.`);
      return false;
    }
    
    // Create redemption record
    const { error } = await supabase
      .from('user_rewards')
      .insert({
        user_id: userId,
        item_id: itemId,
        status: 'pending'
      });
      
    if (error) {
      throw error;
    }
    
    toast.success(`You've successfully redeemed ${item.name}!`);
    return true;
  } catch (error: any) {
    console.error('Error redeeming item:', error);
    toast.error(error.message || 'Failed to redeem item');
    return false;
  }
};

// Get user's redemption history
export const getUserRewards = async (userId: string): Promise<UserReward[]> => {
  try {
    const { data, error } = await supabase
      .from('user_rewards')
      .select(`
        *,
        item:item_id (
          id,
          name,
          description,
          token_cost,
          image_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data.map(reward => ({
      ...reward,
      item: reward.item
    }));
  } catch (error: any) {
    console.error('Error fetching user rewards:', error);
    toast.error('Failed to load reward history');
    return [];
  }
};

// Admin: Get all pending rewards
export const getPendingRewards = async (): Promise<UserReward[]> => {
  try {
    const { data, error } = await supabase
      .from('user_rewards')
      .select(`
        *,
        item:item_id (
          id,
          name,
          description,
          token_cost,
          image_url
        ),
        user:user_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('Error fetching pending rewards:', error);
    toast.error('Failed to load pending rewards');
    return [];
  }
};

// Admin: Update reward status
export const updateRewardStatus = async (
  rewardId: string, 
  status: 'pending' | 'fulfilled' | 'cancelled'
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_rewards')
      .update({ status })
      .eq('id', rewardId);

    if (error) {
      throw error;
    }
    
    toast.success(`Reward ${status === 'fulfilled' ? 'fulfilled' : 'cancelled'} successfully`);
    return true;
  } catch (error: any) {
    console.error('Error updating reward status:', error);
    toast.error('Failed to update reward status');
    return false;
  }
};

// Admin: Create a new store item
export const createStoreItem = async (
  name: string,
  description: string,
  tokenCost: number,
  imageUrl?: string
): Promise<StoreItem | null> => {
  try {
    const { data, error } = await supabase
      .from('store_items')
      .insert({
        name,
        description,
        token_cost: tokenCost,
        image_url: imageUrl || null,
        available: true
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    toast.success('Store item created successfully');
    return data;
  } catch (error: any) {
    console.error('Error creating store item:', error);
    toast.error('Failed to create store item');
    return null;
  }
};

// Admin: Update store item
export const updateStoreItem = async (
  id: string,
  updates: Partial<StoreItem>
): Promise<StoreItem | null> => {
  try {
    const { data, error } = await supabase
      .from('store_items')
      .update({
        name: updates.name,
        description: updates.description,
        token_cost: updates.token_cost,
        image_url: updates.image_url,
        available: updates.available
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    toast.success('Store item updated successfully');
    return data;
  } catch (error: any) {
    console.error('Error updating store item:', error);
    toast.error('Failed to update store item');
    return null;
  }
};

// Admin: Delete store item
export const deleteStoreItem = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('store_items')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    toast.success('Store item deleted successfully');
    return true;
  } catch (error: any) {
    console.error('Error deleting store item:', error);
    toast.error('Failed to delete store item');
    return false;
  }
};
