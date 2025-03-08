
import { supabase } from "@/lib/supabase";
import { HazardReport, HazardType, HazardStatus, Location } from "@/types/supabase";
import { toast } from "sonner";

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
  };
};

// Get all hazard reports
export const getHazardReports = async (): Promise<HazardReport[]> => {
  try {
    const { data, error } = await supabase
      .from('hazard_reports')
      .select(`
        *,
        profiles:reported_by (full_name)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Transform the data to match the HazardReport type
    return data.map((report) => ({
      ...report,
      location: {
        lat: report.lat,
        lng: report.lng,
        address: report.address,
      },
    }));
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
      .eq('reported_by', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform the data to match the HazardReport type
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
      .select(`
        *,
        profiles:reported_by (full_name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Transform the data to match the HazardReport type
    return {
      ...data,
      location: {
        lat: data.lat,
        lng: data.lng,
        address: data.address,
      },
    };
  } catch (error: any) {
    console.error(`Error fetching hazard report with id ${id}:`, error);
    toast.error('Failed to load hazard details');
    return null;
  }
};

// Validate and normalize hazard type
const validateHazardType = (inputType: string): HazardType => {
  // Convert to lowercase for comparison
  const normalizedType = inputType.toLowerCase();
  
  // Check for pothole-related terms
  if (normalizedType.includes('pothole') || normalizedType.includes('hole')) {
    return 'pothole';
  }
  
  // Check for waterlogging-related terms
  if (
    normalizedType.includes('water') || 
    normalizedType.includes('flood') || 
    normalizedType.includes('puddle') ||
    normalizedType.includes('waterlogging')
  ) {
    return 'waterlogging';
  }
  
  // Default to 'other' for anything else
  return 'other';
};

// Create a new hazard report
export const createHazardReport = async (
  hazardType: string,
  description: string,
  location: Location,
  reportedBy: string,
  imageUrl?: string | null
): Promise<HazardReport | null> => {
  try {
    // Validate inputs
    if (!description) {
      throw new Error('Description is required');
    }
    
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number' || !location.address) {
      console.error('Invalid location data:', location);
      throw new Error('Valid location data is required');
    }
    
    if (!reportedBy) {
      throw new Error('User ID is required');
    }
    
    // Convert hazardType to valid enum value
    const validatedType: HazardType = validateHazardType(hazardType || 'other');
    
    console.log('Creating hazard report with data:', {
      type: validatedType,
      description,
      location,
      reportedBy,
      imageUrl
    });

    const { data, error } = await supabase
      .from('hazard_reports')
      .insert({
        type: validatedType,
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
      console.error('Supabase error details:', error);
      throw error;
    }

    return transformHazardRow(data);
  } catch (error: any) {
    console.error('Error creating hazard report:', error);
    toast.error(error.message || 'Failed to create hazard report');
    throw error; // Re-throw to allow the component to handle the error
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

      if (deleteError) throw deleteError;

      // Decrement vote count
      const { error: updateError } = await supabase.rpc('decrement_hazard_votes', {
        hazard_id: hazardId
      });

      if (updateError) throw updateError;

      return false;
    } else {
      // Add vote
      const { error: insertError } = await supabase
        .from('hazard_votes')
        .insert({
          hazard_id: hazardId,
          user_id: userId,
        });

      if (insertError) throw insertError;

      // Increment vote count
      const { error: updateError } = await supabase.rpc('increment_hazard_votes', {
        hazard_id: hazardId
      });

      if (updateError) throw updateError;

      return true;
    }
  } catch (error: any) {
    console.error(`Error voting for hazard report with id ${hazardId}:`, error);
    toast.error('Failed to register vote');
    return false;
  }
};

// Admin functions
export const getAdminHazardReports = async (): Promise<HazardReport[]> => {
  try {
    const { data, error } = await supabase
      .from("hazard_reports")
      .select(`
        *,
        profiles:reported_by (full_name)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Transform the data to match the HazardReport type with address in location
    return data.map((report) => ({
      ...report,
      location: {
        lat: report.lat,
        lng: report.lng,
        address: report.address,
      },
      // Add a reporter_name property from the joined profiles data
      reporter_name: report.profiles?.full_name || "Unknown",
    }));
  } catch (error: any) {
    console.error("Error fetching admin hazard reports:", error);
    return [];
  }
};

// Update hazard status
export const updateHazardStatus = async (id: string, status: HazardStatus): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("hazard_reports")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error("Error updating hazard status:", error);
    return false;
  }
};

// Check if user is an admin
export const checkIfUserIsAdmin = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .single();

    if (error) throw error;
    return data.is_admin || false;
  } catch (error: any) {
    console.error("Error checking if user is admin:", error);
    return false;
  }
};
