
import { ethers } from 'ethers';

// SafetyCoin token contract details
const TOKEN_CONTRACT_ADDRESS = "0x25070c9c10fB46091ee1f90350A8331248AdEaC6";
const YOUR_WALLET_ADDRESS = "0x070c91BfaC5fB9609bD26367C663a80663B478Ca";
const YOUR_PRIVATE_KEY = "9c138e268514557e980655548fe7449fec6ce1b626fbf65eaa0908c49ceb4063";
const ALCHEMY_RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/DxZUOjRpVIOq2VZQSuwNz0OHBwkXcCIN";

// ERC-20 ABI
const TOKEN_ABI = [
  {
    "constant": false,
    "inputs": [
      { "name": "_to", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": "transfer",
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

export const transferTokens = async (recipient: string, amount: string = "25000000000000000000") => {
  try {
    // Use correct provider syntax for Ethers v5
    const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_RPC_URL);
    const wallet = new ethers.Wallet(YOUR_PRIVATE_KEY, provider);

    // Connect to SafetyCoin contract
    const contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_ABI, wallet);

    console.log(`Sending tokens to ${recipient}...`);

    // Send transaction
    const tx = await contract.transfer(recipient, amount);
    const receipt = await tx.wait();

    console.log("Transaction Hash:", tx.hash);

    return {
      success: true,
      transactionHash: tx.hash
    };
  } catch (error: any) {
    console.error("Error transferring tokens:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const checkNetworkConnection = async () => {
  if (typeof window === 'undefined' || typeof window.ethereum === "undefined") {
    return { success: false, message: "MetaMask is not installed" };
  }

  try {
    // Request account access
    const accounts = await window.ethereum.request({ 
      method: "eth_requestAccounts" 
    });
    
    // Check if on Sepolia network (chainId 11155111)
    const chainId = await window.ethereum.request({ 
      method: "eth_chainId" 
    });
    
    if (chainId !== "0xaa36a7") { // Sepolia chainId in hex
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xaa36a7" }],
        });
        // Check again after attempting to switch
        const newChainId = await window.ethereum.request({
          method: "eth_chainId"
        });
        
        if (newChainId !== "0xaa36a7") {
          return { success: false, message: "Failed to switch to Sepolia network" };
        }
      } catch (switchError) {
        return { success: false, message: "Failed to switch to Sepolia network" };
      }
    }
    
    return { success: true, account: accounts[0] };
  } catch (error) {
    console.error("Error connecting to MetaMask:", error);
    return { success: false, message: "Failed to connect to wallet" };
  }
};

// Add global type declaration
declare global {
  interface Window {
    ethereum: any;
  }
}
