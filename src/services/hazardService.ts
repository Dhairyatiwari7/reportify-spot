
import { supabase } from "@/lib/supabase";
import { HazardReport, HazardType, HazardStatus, Location } from "@/types/supabase";

// Create a new hazard report
export const createHazardReport = async (
  type: HazardType,
  description: string,
  location: Location,
  userId: string,
  imageUrl?: string | null
): Promise<HazardReport | null> => {
  try {
    const { data, error } = await supabase
      .from("hazard_reports")
      .insert({
        type: type,
        description: description,
        lat: location.lat,
        lng: location.lng,
        address: location.address,
        reported_by: userId,
        image_url: imageUrl,
        token_reward: 10, // Default token reward for reporting a hazard
      })
      .select()
      .single();

    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error("Error creating hazard report:", error);
    return null;
  }
};

// Get all hazard reports
export const getHazardReports = async (): Promise<HazardReport[]> => {
  try {
    const { data, error } = await supabase
      .from("hazard_reports")
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
  } catch (error) {
    console.error("Error fetching hazard reports:", error);
    return [];
  }
};

// Get hazard reports by user ID
export const getUserHazardReports = async (userId: string): Promise<HazardReport[]> => {
  try {
    const { data, error } = await supabase
      .from("hazard_reports")
      .select("*")
      .eq("reported_by", userId)
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
  } catch (error) {
    console.error("Error fetching user hazard reports:", error);
    return [];
  }
};

// Get a single hazard report by ID
export const getHazardReportById = async (id: string): Promise<HazardReport | null> => {
  try {
    const { data, error } = await supabase
      .from("hazard_reports")
      .select(`
        *,
        profiles:reported_by (full_name)
      `)
      .eq("id", id)
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
  } catch (error) {
    console.error("Error fetching hazard report:", error);
    return null;
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    console.error("Error checking if user is admin:", error);
    return false;
  }
};
