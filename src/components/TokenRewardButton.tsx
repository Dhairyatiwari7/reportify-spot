
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { transferTokens, checkNetworkConnection } from "@/services/tokenService";

// Amount of tokens to reward (25 tokens)
const REWARD_AMOUNT = "25000000000000000000"; 

interface TokenRewardButtonProps {
  onSuccess?: () => void;
  buttonText?: string;
}

declare global {
  interface Window {
    ethereum: any;
  }
}

const TokenRewardButton: React.FC<TokenRewardButtonProps> = ({ 
  onSuccess, 
  buttonText = "Submit Report & Earn 25 SafetyCoin" 
}) => {
  const [isTransferring, setIsTransferring] = useState(false);

  // Handle button click
  const handleClick = async () => {
    try {
      setIsTransferring(true);
      
      // First check network connection and get user address
      const connection = await checkNetworkConnection();
      
      if (!connection.success) {
        toast.error(connection.message);
        setIsTransferring(false);
        return;
      }
      
      const userAddress = connection.account;
      console.log("Connected wallet address:", userAddress);
      
      // Transfer tokens directly (server-side handling)
      const result = await transferTokens(userAddress, REWARD_AMOUNT);
      
      if (result.success) {
        toast.success("25 SafetyCoin tokens sent to your wallet!");
        
        // Call the success callback if provided
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(`Failed to transfer tokens: ${result.error}`);
      }
    } catch (error: any) {
      console.error("Error during token transfer process:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <Button 
      variant="default" 
      onClick={handleClick}
      disabled={isTransferring}
    >
      {isTransferring ? (
        <>
          <div className="animate-spin h-4 w-4 border-2 border-t-transparent rounded-full mr-2"></div>
          Sending Tokens...
        </>
      ) : (
        buttonText
      )}
    </Button>
  );
};

export default TokenRewardButton;
