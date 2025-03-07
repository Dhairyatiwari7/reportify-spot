
import { supabase } from '@/lib/supabase';
import { HazardReport, HazardStatus, HazardType, Location } from '@/types/supabase';
import { toast } from 'sonner';

// Transform database row to HazardReport
const transformHazardRow = (row: any): HazardReport => {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    location: {
      lat: row.lat,
      lng: row.lng,
      address: row.address,
    },
    reported_by: row.reported_by,
    reported_at: row.created_at,
    status: row.status,
    votes: row.votes,
    comments: row.comments,
    image_url: row.image_url,
    token_reward: row.token_reward
  };
};

// Get all hazard reports
export const getHazardReports = async (): Promise<HazardReport[]> => {
  try {
    const { data, error } = await supabase
      .from('hazard_reports')
      .select('*');

    if (error) {
      throw error;
    }

    return data.map(transformHazardRow);
  } catch (error: any) {
    console.error('Error fetching hazard reports:', error);
    toast.error('Failed to load hazard reports');
    return [];
  }
};

// Get hazard reports by user ID
export const getUserHazardReports = async (userId: string): Promise<HazardReport[]> => {
  try {
    const { data, error } = await supabase
      .from('hazard_reports')
      .select('*')
      .eq('reported_by', userId);

    if (error) {
      throw error;
    }

    return data.map(transformHazardRow);
  } catch (error: any) {
    console.error('Error fetching user hazard reports:', error);
    toast.error('Failed to load your reports');
    return [];
  }
};

// Get a single hazard report by ID
export const getHazardReportById = async (id: string): Promise<HazardReport | null> => {
  try {
    const { data, error } = await supabase
      .from('hazard_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    return transformHazardRow(data);
  } catch (error: any) {
    console.error(`Error fetching hazard report with id ${id}:`, error);
    toast.error('Failed to load hazard details');
    return null;
  }
};

// Create a new hazard report
export const createHazardReport = async (
  type: HazardType,
  description: string,
  location: Location,
  reportedBy: string,
  imageUrl?: string
): Promise<HazardReport | null> => {
  try {
    const { data, error } = await supabase
      .from('hazard_reports')
      .insert({
        type,
        description,
        lat: location.lat,
        lng: location.lng,
        address: location.address,
        reported_by: reportedBy,
        status: 'active' as HazardStatus,
        votes: 0,
        comments: 0,
        image_url: imageUrl || null,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return transformHazardRow(data);
  } catch (error: any) {
    console.error('Error creating hazard report:', error);
    toast.error('Failed to create hazard report');
    return null;
  }
};

// Update a hazard report
export const updateHazardReport = async (
  id: string,
  updates: Partial<HazardReport>
): Promise<HazardReport | null> => {
  try {
    const updateData: any = {};
    
    if (updates.type) updateData.type = updates.type;
    if (updates.description) updateData.description = updates.description;
    if (updates.status) updateData.status = updates.status;
    if (updates.location) {
      updateData.lat = updates.location.lat;
      updateData.lng = updates.location.lng;
      updateData.address = updates.location.address;
    }
    if (updates.image_url !== undefined) updateData.image_url = updates.image_url;

    const { data, error } = await supabase
      .from('hazard_reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return transformHazardRow(data);
  } catch (error: any) {
    console.error(`Error updating hazard report with id ${id}:`, error);
    toast.error('Failed to update hazard report');
    return null;
  }
};

// Vote for a hazard report
export const voteHazardReport = async (hazardId: string, userId: string): Promise<boolean> => {
  try {
    // Check if the user has already voted
    const { data: existingVote, error: checkError } = await supabase
      .from('hazard_votes')
      .select('*')
      .eq('hazard_id', hazardId)
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingVote) {
      // Remove vote
      const { error: deleteError } = await supabase
        .from('hazard_votes')
        .delete()
        .eq('id', existingVote.id);

      if (deleteError) {
        throw deleteError;
      }

      // Decrement vote count
      const { error: updateError } = await supabase.rpc('decrement_hazard_votes', {
        hazard_id: hazardId
      });

      if (updateError) {
        throw updateError;
      }

      return false;
    } else {
      // Add vote
      const { error: insertError } = await supabase
        .from('hazard_votes')
        .insert({
          hazard_id: hazardId,
          user_id: userId,
        });

      if (insertError) {
        throw insertError;
      }

      // Increment vote count
      const { error: updateError } = await supabase.rpc('increment_hazard_votes', {
        hazard_id: hazardId
      });

      if (updateError) {
        throw updateError;
      }

      return true;
    }
  } catch (error: any) {
    console.error(`Error voting for hazard report with id ${hazardId}:`, error);
    toast.error('Failed to register vote');
    return false;
  }
};

// Admin: Get all hazard reports for admin dashboard
export const getAdminHazardReports = async (): Promise<HazardReport[]> => {
  try {
    const { data, error } = await supabase
      .from('hazard_reports')
      .select(`
        *,
        reporter:reported_by (
          full_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data.map(row => ({
      ...transformHazardRow(row),
      reporter_name: row.reporter?.full_name
    }));
  } catch (error: any) {
    console.error('Error fetching admin hazard reports:', error);
    toast.error('Failed to load hazard reports');
    return [];
  }
};

// Admin: Update hazard status
export const updateHazardStatus = async (
  id: string, 
  status: HazardStatus
): Promise<HazardReport | null> => {
  try {
    const { data, error } = await supabase
      .from('hazard_reports')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    toast.success(`Hazard status updated to ${status}`);
    return transformHazardRow(data);
  } catch (error: any) {
    console.error(`Error updating hazard status for id ${id}:`, error);
    toast.error('Failed to update hazard status');
    return null;
  }
};

// Admin: Check if user is admin
export const checkIfUserIsAdmin = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    return data.is_admin === true;
  } catch (error: any) {
    console.error('Error checking admin status:', error);
    return false;
  }
};
