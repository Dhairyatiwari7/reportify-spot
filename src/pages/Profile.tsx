import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getUserHazardReports } from "@/services/hazardService";
import { getUserRewards, getUserTokens } from "@/services/rewardService";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { HazardReport, UserReward } from "@/types/supabase";
import { User, Upload, Award, MapPin, Calendar, Package, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";

const Profile = () => {
  const [activeTab, setActiveTab] = useState("profile");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userReports, setUserReports] = useState<HazardReport[]>([]);
  const [userRewards, setUserRewards] = useState<UserReward[]>([]);
  const [tokens, setTokens] = useState(0);
  
  const { user, updateUserProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      toast.error("Please log in to view your profile");
      navigate("/login");
      return;
    }

    const fetchProfileData = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        if (data) {
          setFullName(data.full_name || "");
          setEmail(user.email || "");
          setAvatarUrl(data.avatar_url);
          setTokens(data.tokens || 0);
        }

        // Fetch user reports
        const reports = await getUserHazardReports(user.id);
        setUserReports(reports);

        // Fetch user rewards
        const rewards = await getUserRewards(user.id);
        setUserRewards(rewards);

      } catch (error) {
        console.error("Error fetching profile:", error);
        toast.error("Failed to load profile data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [user, navigate]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    setIsSaving(true);
    
    try {
      await updateUserProfile({
        id: user.id,
        fullName,
        avatarUrl
      });
      
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }
      
      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${user?.id}/avatar.${fileExt}`;
      
      let { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) {
        throw uploadError;
      }
      
      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);
      
      setAvatarUrl(data.publicUrl);
      toast.success("Avatar uploaded successfully");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Error uploading avatar");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "fulfilled":
        return <Badge variant="outline" className="bg-green-100 text-green-800">Fulfilled</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-100 text-red-800">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          <span className="ml-3">Loading profile...</span>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-8">
              <TabsTrigger value="profile" className="flex items-center">
                <User className="mr-2 h-4 w-4" /> Profile
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center">
                <AlertTriangle className="mr-2 h-4 w-4" /> My Reports
                {userReports.length > 0 && <Badge className="ml-2">{userReports.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="rewards" className="flex items-center">
                <Award className="mr-2 h-4 w-4" /> My Rewards
                {userRewards.length > 0 && <Badge className="ml-2">{userRewards.length}</Badge>}
              </TabsList>

            <TabsContent value="profile" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>
                    Manage your account details and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileUpdate} className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex flex-col items-center sm:flex-row sm:space-x-6">
                        <Avatar className="h-24 w-24">
                          <AvatarImage src={avatarUrl || ""} alt={fullName} />
                          <AvatarFallback className="text-lg">
                            {fullName.split(" ").map(n => n[0]).join("").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="mt-4 sm:mt-0 flex-1">
                          <div className="flex flex-col space-y-1.5">
                            <label htmlFor="avatar" className="text-sm font-medium">
                              Profile Photo
                            </label>
                            <Input
                              id="avatar"
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  uploadAvatar(e);
                                }
                              }}
                              className="cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col space-y-1.5">
                        <label htmlFor="name" className="text-sm font-medium">
                          Full Name
                        </label>
                        <Input
                          id="name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Your full name"
                        />
                      </div>

                      <div className="flex flex-col space-y-1.5">
                        <label htmlFor="email" className="text-sm font-medium">
                          Email
                        </label>
                        <Input
                          id="email"
                          value={email}
                          readOnly
                          disabled
                          className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Email cannot be changed
                        </p>
                      </div>

                      <div className="bg-muted/30 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between border">
                        <div className="flex items-center mb-4 sm:mb-0">
                          <Award className="h-8 w-8 text-amber-500 mr-3" />
                          <div>
                            <h3 className="font-medium">Token Balance</h3>
                            <p className="text-2xl font-bold">{tokens}</p>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate("/store")}
                        >
                          Visit Store
                        </Button>
                      </div>
                    </div>

                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </form>
                </CardContent>
                <CardFooter className="flex flex-col items-start">
                  <Separator className="my-4 w-full" />
                  <div className="text-sm text-muted-foreground">
                    <p>
                      Report hazards in your community to earn tokens, which
                      you can redeem for rewards in our store.
                    </p>
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="reports" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>My Hazard Reports</CardTitle>
                  <CardDescription>
                    Track the status of hazards you've reported
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {userReports.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">No reports yet</h3>
                      <p className="text-muted-foreground mt-1">
                        You haven't reported any hazards yet
                      </p>
                      <Button
                        onClick={() => navigate("/report")}
                        className="mt-4"
                      >
                        Report a Hazard
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {userReports.map((report) => (
                        <div
                          key={report.id}
                          className="flex flex-col sm:flex-row border rounded-lg overflow-hidden"
                        >
                          {report.image_url && (
                            <div className="sm:w-1/3 h-40 sm:h-auto">
                              <img
                                src={report.image_url}
                                alt={report.description}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          )}
                          <div className="p-4 flex-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <Badge
                                  className={`${
                                    report.status === "active"
                                      ? "bg-yellow-500"
                                      : report.status === "investigating"
                                      ? "bg-blue-500"
                                      : "bg-green-500"
                                  } text-white mb-2`}
                                >
                                  {report.status.charAt(0).toUpperCase() +
                                    report.status.slice(1)}
                                </Badge>
                                <h3 className="font-medium">{report.description}</h3>
                              </div>
                              <Badge variant="outline">
                                +{report.token_reward} Tokens
                              </Badge>
                            </div>

                            <div className="text-sm text-muted-foreground mt-2 space-y-1">
                              <div className="flex items-center">
                                <MapPin className="h-3.5 w-3.5 mr-1" />
                                <span className="line-clamp-1">
                                  {report.location.address}
                                </span>
                              </div>
                              <div className="flex items-center">
                                <Calendar className="h-3.5 w-3.5 mr-1" />
                                <span>
                                  Reported on{" "}
                                  {format(
                                    new Date(report.reported_at),
                                    "MMM d, yyyy"
                                  )}
                                </span>
                              </div>
                            </div>

                            <div className="mt-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/report/${report.id}`)}
                              >
                                View Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rewards" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>My Rewards</CardTitle>
                  <CardDescription>
                    Track your redeemed rewards and their status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {userRewards.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">No rewards yet</h3>
                      <p className="text-muted-foreground mt-1">
                        You haven't redeemed any rewards yet
                      </p>
                      <Button
                        onClick={() => navigate("/store")}
                        className="mt-4"
                      >
                        Visit Store
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userRewards.map((reward) => (
                        <div
                          key={reward.id}
                          className="border rounded-lg p-4"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-medium">{reward.item?.name}</h3>
                            {getStatusBadge(reward.status)}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {reward.item?.description}
                          </p>
                          <div className="flex items-center text-amber-500 mb-4">
                            <Award className="h-4 w-4 mr-1" />
                            <span className="font-medium">
                              {reward.item?.token_cost} Tokens
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Redeemed on{" "}
                            {format(new Date(reward.created_at), "MMM d, yyyy")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <div className="w-full flex justify-between items-center">
                    <div className="flex items-center">
                      <Award className="h-5 w-5 text-amber-500 mr-2" />
                      <span className="font-medium">{tokens} Tokens Available</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/store")}
                    >
                      Redeem More Rewards
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Profile;
