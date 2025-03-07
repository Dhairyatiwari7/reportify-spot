
import { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShoppingCart, Award, ChevronRight, Clock, CheckCircle, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { StoreItem, UserReward } from "@/types/supabase";
import { getStoreItems, getUserTokens, redeemReward, getUserRewards } from "@/services/rewardService";

const Store = () => {
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [userRewards, setUserRewards] = useState<UserReward[]>([]);
  const [userTokens, setUserTokens] = useState(0);
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("store");
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      toast.error("Please log in to access the store");
      navigate("/login");
      return;
    }

    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const [items, tokens, rewards] = await Promise.all([
        getStoreItems(),
        getUserTokens(user.id),
        getUserRewards(user.id)
      ]);
      
      setStoreItems(items);
      setUserTokens(tokens);
      setUserRewards(rewards);
    } catch (error) {
      console.error("Error loading store data:", error);
      toast.error("Failed to load store data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedeemItem = async () => {
    if (!user || !selectedItem) return;
    
    setIsRedeeming(true);
    try {
      if (userTokens < selectedItem.token_cost) {
        toast.error("You don't have enough tokens to redeem this item");
        return;
      }
      
      const success = await redeemReward(
        user.id, 
        selectedItem.id,
        selectedItem.token_cost
      );
      
      if (success) {
        toast.success(`Successfully redeemed ${selectedItem.name}`);
        setUserTokens(prev => prev - selectedItem.token_cost);
        setIsDialogOpen(false);
        
        // Reload user rewards after redemption
        const rewards = await getUserRewards(user.id);
        setUserRewards(rewards);
        
        // Switch to the rewards tab
        setActiveTab("rewards");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to redeem item");
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleItemClick = (item: StoreItem) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
      case "fulfilled":
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Fulfilled</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">Cancelled</Badge>;
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
              <Award className="mr-2 h-8 w-8 text-primary" />
              Rewards Store
            </h1>
            <p className="text-muted-foreground mt-1">
              Redeem your tokens for rewards
            </p>
          </div>
          
          <div className="bg-primary/10 px-4 py-2 rounded-lg border border-primary/20 flex items-center">
            <Award className="text-primary mr-2 h-5 w-5" />
            <span className="font-medium">{userTokens} Tokens Available</span>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="store" className="flex-1 sm:flex-initial">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Store
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex-1 sm:flex-initial">
              <Award className="mr-2 h-4 w-4" />
              My Rewards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="store" className="space-y-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : storeItems.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/30">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No items available</h3>
                <p className="text-muted-foreground mt-1">
                  Check back later for new rewards
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {storeItems.map((item) => (
                  <Card 
                    key={item.id} 
                    className={`overflow-hidden transition-all hover:shadow-md cursor-pointer ${
                      userTokens < item.token_cost ? "opacity-60" : ""
                    }`}
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="h-48 overflow-hidden bg-muted">
                      {item.image_url ? (
                        <img 
                          src={item.image_url} 
                          alt={item.name} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Award className="h-16 w-16 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <CardHeader className="pb-2">
                      <CardTitle>{item.name}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                    <CardFooter className="pt-2 flex justify-between items-center">
                      <div className="flex items-center text-amber-600 font-medium">
                        <Award className="h-4 w-4 mr-1" />
                        {item.token_cost} Tokens
                      </div>
                      <Button 
                        size="sm" 
                        disabled={userTokens < item.token_cost}
                      >
                        {userTokens < item.token_cost ? "Not Enough Tokens" : "Redeem"}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rewards" className="space-y-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : userRewards.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/30">
                <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No rewards yet</h3>
                <p className="text-muted-foreground mt-1 mb-4">
                  You haven't redeemed any rewards yet
                </p>
                <Button onClick={() => setActiveTab("store")}>
                  Browse Store
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {userRewards.map((reward) => (
                  <Card key={reward.id} className="overflow-hidden">
                    <div className="flex flex-col sm:flex-row">
                      {reward.item?.image_url && (
                        <div className="w-full sm:w-32 h-32 overflow-hidden bg-muted">
                          <img 
                            src={reward.item.image_url} 
                            alt={reward.item.name} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                      )}
                      <div className="flex-1 p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                          <div>
                            <h3 className="font-medium text-lg">{reward.item?.name}</h3>
                            <p className="text-sm text-muted-foreground">{reward.item?.description}</p>
                          </div>
                          {getStatusBadge(reward.status)}
                        </div>
                        <div className="flex flex-col xs:flex-row xs:items-center justify-between mt-4">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" />
                            Redeemed on {format(new Date(reward.created_at), 'MMM d, yyyy')}
                          </div>
                          <div className="flex items-center text-amber-600 mt-2 xs:mt-0">
                            <Award className="h-4 w-4 mr-1" />
                            {reward.item?.token_cost} Tokens
                          </div>
                        </div>
                        {reward.status === "fulfilled" && (
                          <div className="mt-3 p-2 bg-green-50 border border-green-100 rounded-md flex items-center">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            <span className="text-sm text-green-700">
                              This reward has been fulfilled on {format(new Date(reward.redemption_date), 'MMM d, yyyy')}
                            </span>
                          </div>
                        )}
                        {reward.status === "cancelled" && (
                          <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded-md flex items-center">
                            <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                            <span className="text-sm text-red-700">
                              This reward request was cancelled
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redeem Reward</DialogTitle>
            <DialogDescription>
              Confirm that you want to redeem this reward using your available tokens.
            </DialogDescription>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{selectedItem.name}</h3>
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                  {selectedItem.token_cost} Tokens
                </Badge>
              </div>
              
              <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
              
              {selectedItem.image_url && (
                <div className="h-48 overflow-hidden rounded-md">
                  <img 
                    src={selectedItem.image_url} 
                    alt={selectedItem.name} 
                    className="w-full h-full object-cover" 
                  />
                </div>
              )}
              
              <div className="bg-muted/40 p-3 rounded-md text-sm">
                <p>Your available tokens: <span className="font-semibold">{userTokens}</span></p>
                <p>
                  After redemption: <span className="font-semibold">{userTokens - selectedItem.token_cost}</span>
                </p>
              </div>
              
              {userTokens < selectedItem.token_cost && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded-md flex items-center">
                  <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                  You don't have enough tokens to redeem this reward
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRedeemItem}
              disabled={!selectedItem || userTokens < (selectedItem?.token_cost || 0) || isRedeeming}
            >
              {isRedeeming ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Award className="mr-2 h-4 w-4" />
                  Redeem Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default Store;
