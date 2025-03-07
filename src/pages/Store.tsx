
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { 
  ShoppingCart, 
  Award, 
  Clock, 
  AlertCircle, 
  CheckCircle,
  Coins,
  BadgePercent,
  ShoppingBag
} from "lucide-react";
import { format } from "date-fns";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { StoreItem, UserReward } from "@/types/supabase";
import { 
  getStoreItems, 
  redeemStoreItem, 
  getUserRewards, 
  getUserProfile 
} from "@/services/rewardService";

const Store = () => {
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [rewards, setRewards] = useState<UserReward[]>([]);
  const [userTokens, setUserTokens] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("store");
  const navigate = useNavigate();
  const { user } = useAuth();

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
      // Get user profile for token balance
      const profile = await getUserProfile(user.id);
      if (profile) {
        setUserTokens(profile.tokens);
      }
      
      // Get store items and reward history in parallel
      const [items, userRewards] = await Promise.all([
        getStoreItems(),
        getUserRewards(user.id)
      ]);
      
      setStoreItems(items);
      setRewards(userRewards);
    } catch (error) {
      console.error("Error loading store data:", error);
      toast.error("Failed to load store data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedeemItem = (item: StoreItem) => {
    // Check if user has enough tokens
    if (userTokens < item.token_cost) {
      toast.error(`You need ${item.token_cost} tokens to redeem this item. You have ${userTokens} tokens.`);
      return;
    }
    
    setSelectedItem(item);
    setIsDialogOpen(true);
  };

  const confirmRedeem = async () => {
    if (!user || !selectedItem) return;
    
    const success = await redeemStoreItem(user.id, selectedItem.id);
    if (success) {
      // Update local state
      setUserTokens(prev => prev - selectedItem.token_cost);
      
      // Refresh rewards list
      const updatedRewards = await getUserRewards(user.id);
      setRewards(updatedRewards);
      
      toast.success(`You've successfully redeemed ${selectedItem.name}!`);
    }
    
    setIsDialogOpen(false);
    setSelectedItem(null);
  };

  const getRewardStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <div className="flex items-center text-amber-500">
            <Clock className="h-4 w-4 mr-1" />
            <span>Pending</span>
          </div>
        );
      case "fulfilled":
        return (
          <div className="flex items-center text-green-500">
            <CheckCircle className="h-4 w-4 mr-1" />
            <span>Fulfilled</span>
          </div>
        );
      case "cancelled":
        return (
          <div className="flex items-center text-destructive">
            <AlertCircle className="h-4 w-4 mr-1" />
            <span>Cancelled</span>
          </div>
        );
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
              <ShoppingCart className="mr-2 h-8 w-8 text-primary" />
              Rewards Store
            </h1>
            <p className="text-muted-foreground mt-1">
              Redeem your earned tokens for rewards
            </p>
          </div>

          <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-lg">
            <Coins className="h-5 w-5 text-yellow-500" />
            <span className="font-medium">{userTokens} Tokens Available</span>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="store" className="flex items-center">
              <ShoppingBag className="mr-2 h-4 w-4" />
              Store
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center">
              <Award className="mr-2 h-4 w-4" />
              My Rewards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="store" className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : storeItems.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/30">
                <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No items available</h3>
                <p className="text-muted-foreground mt-1">
                  Check back later for new rewards
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {storeItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden">
                    {item.image_url && (
                      <div className="h-48 overflow-hidden">
                        <img 
                          src={item.image_url} 
                          alt={item.name} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle>{item.name}</CardTitle>
                      <CardDescription>
                        <div className="flex items-center mt-1">
                          <Coins className="h-4 w-4 mr-1 text-yellow-500" />
                          <span>{item.token_cost} Tokens</span>
                        </div>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{item.description}</p>
                    </CardContent>
                    <CardFooter>
                      <Button 
                        className="w-full" 
                        onClick={() => handleRedeemItem(item)}
                        disabled={userTokens < item.token_cost}
                      >
                        {userTokens < item.token_cost ? (
                          <>Not Enough Tokens</>
                        ) : (
                          <>Redeem Reward</>
                        )}
                      </Button>
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
            ) : rewards.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/30">
                <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No rewards yet</h3>
                <p className="text-muted-foreground mt-1">
                  You haven't redeemed any rewards yet. Visit the store to redeem tokens.
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setActiveTab("store")}
                >
                  Go to Store
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rewards.map((reward) => (
                  <Card key={reward.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{reward.item?.name}</CardTitle>
                      <CardDescription>
                        <div className="flex items-center mt-1">
                          <BadgePercent className="h-4 w-4 mr-1 text-primary" />
                          <span>{reward.item?.token_cost} Tokens</span>
                        </div>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{reward.item?.description}</p>
                      <div className="mt-4 flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(reward.redemption_date), 'MMM d, yyyy')}
                        </span>
                        {getRewardStatusBadge(reward.status)}
                      </div>
                    </CardContent>
                    <CardFooter>
                      {reward.status === "fulfilled" && (
                        <Button variant="outline" className="w-full" disabled>
                          Already Redeemed
                        </Button>
                      )}
                      {reward.status === "pending" && (
                        <Button variant="outline" className="w-full" disabled>
                          Processing
                        </Button>
                      )}
                      {reward.status === "cancelled" && (
                        <Button variant="outline" className="w-full" disabled>
                          Cancelled
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Redemption</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to redeem {selectedItem?.name} for {selectedItem?.token_cost} tokens?
                You currently have {userTokens} tokens.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRedeem}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
      <Footer />
    </div>
  );
};

export default Store;
