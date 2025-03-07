
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Search, 
  Shield, 
  Package,
  Award,
  MapPin,
  Calendar,
  User
} from "lucide-react";
import { format } from "date-fns";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { 
  getAdminHazardReports, 
  updateHazardStatus, 
  checkIfUserIsAdmin 
} from "@/services/hazardService";
import { 
  getPendingRewards, 
  updateRewardStatus 
} from "@/services/rewardService";
import { HazardReport, UserReward, HazardStatus } from "@/types/supabase";

const AdminPortal = () => {
  const [hazards, setHazards] = useState<HazardReport[]>([]);
  const [pendingRewards, setPendingRewards] = useState<UserReward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("hazards");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<HazardStatus | "all">("all");
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        toast.error("Please log in to access admin portal");
        navigate("/login");
        return;
      }

      const isAdmin = await checkIfUserIsAdmin(user.id);
      if (!isAdmin) {
        toast.error("You don't have permission to access this page");
        navigate("/");
        return;
      }

      loadData();
    };

    checkAdmin();
  }, [user, navigate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [hazardData, rewardData] = await Promise.all([
        getAdminHazardReports(),
        getPendingRewards()
      ]);
      
      setHazards(hazardData);
      setPendingRewards(rewardData);
    } catch (error) {
      console.error("Error loading admin data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateHazardStatus = async (hazardId: string, status: HazardStatus) => {
    const result = await updateHazardStatus(hazardId, status);
    if (result) {
      // Update local state
      setHazards(hazards.map(h => 
        h.id === hazardId ? { ...h, status } : h
      ));
      
      toast.success(`Hazard status updated to ${status}`);
    }
  };

  const handleUpdateRewardStatus = async (rewardId: string, status: 'fulfilled' | 'cancelled') => {
    const success = await updateRewardStatus(rewardId, status);
    if (success) {
      // Remove from pending rewards
      setPendingRewards(pendingRewards.filter(r => r.id !== rewardId));
    }
  };

  const filteredHazards = hazards.filter(hazard => {
    const matchesSearch = 
      hazard.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hazard.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hazard.type.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || hazard.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: HazardStatus) => {
    switch (status) {
      case "active":
        return <Badge variant="destructive" className="ml-2">Active</Badge>;
      case "investigating":
        return <Badge variant="secondary" className="ml-2">Investigating</Badge>;
      case "resolved":
        return <Badge variant="default" className="bg-green-500 ml-2">Resolved</Badge>;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: HazardStatus) => {
    switch (status) {
      case "active":
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case "investigating":
        return <Clock className="h-5 w-5 text-amber-500" />;
      case "resolved":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return null;
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Shield className="mr-2 h-8 w-8 text-primary" />
              Admin Portal
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage hazard reports and user rewards
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={loadData}
            >
              Refresh
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="hazards" className="flex items-center">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Hazard Reports
              {hazards.filter(h => h.status === "active").length > 0 && (
                <Badge className="ml-2">{hazards.filter(h => h.status === "active").length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center">
              <Award className="mr-2 h-4 w-4" />
              Pending Rewards
              {pendingRewards.length > 0 && (
                <Badge className="ml-2">{pendingRewards.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hazards" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search hazard reports..."
                  className="pl-10 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as HazardStatus | "all")}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : filteredHazards.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/30">
                <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No hazard reports found</h3>
                <p className="text-muted-foreground mt-1">
                  {searchQuery || filterStatus !== "all" 
                    ? "Try adjusting your search or filters" 
                    : "No hazard reports have been submitted yet"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredHazards.map((hazard) => (
                  <Card key={hazard.id} className="overflow-hidden">
                    {hazard.image_url && (
                      <div className="h-40 overflow-hidden">
                        <img 
                          src={hazard.image_url} 
                          alt={hazard.type} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="capitalize flex items-center">
                            {hazard.type}
                            {getStatusBadge(hazard.status)}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Reported on {format(new Date(hazard.reported_at), 'MMM d, yyyy')}
                          </CardDescription>
                        </div>
                        {getStatusIcon(hazard.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <p className="text-sm line-clamp-2">{hazard.description}</p>
                      <div className="flex items-center mt-3 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 mr-1" />
                        <span className="line-clamp-1">{hazard.location.address}</span>
                      </div>
                      <div className="flex items-center mt-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3 mr-1" />
                        <span>Reported by: {(hazard as any).reporter_name || "Unknown"}</span>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-2 flex justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/report/${hazard.id}`)}
                      >
                        View Details
                      </Button>
                      <div className="flex gap-2">
                        {hazard.status === "active" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleUpdateHazardStatus(hazard.id, "investigating")}
                          >
                            Investigate
                          </Button>
                        )}
                        {(hazard.status === "active" || hazard.status === "investigating") && (
                          <Button
                            variant="default"
                            size="sm"
                            className="bg-green-500 hover:bg-green-600"
                            onClick={() => handleUpdateHazardStatus(hazard.id, "resolved")}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rewards" className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : pendingRewards.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/30">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No pending rewards</h3>
                <p className="text-muted-foreground mt-1">
                  All user reward redemptions have been processed
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingRewards.map((reward) => (
                  <Card key={reward.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{reward.item?.name}</CardTitle>
                      <CardDescription>
                        <div className="flex items-center mt-1">
                          <Award className="h-4 w-4 mr-1 text-amber-500" />
                          <span>{reward.item?.token_cost} Tokens</span>
                        </div>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{reward.item?.description}</p>
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <User className="h-3 w-3 mr-1" />
                          <span>User: {(reward as any).user?.full_name || "Unknown"}</span>
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 mr-1" />
                          <span>Requested: {format(new Date(reward.created_at), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleUpdateRewardStatus(reward.id, 'cancelled')}
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm"
                        className="bg-green-500 hover:bg-green-600"
                        onClick={() => handleUpdateRewardStatus(reward.id, 'fulfilled')}
                      >
                        Fulfill
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default AdminPortal;
