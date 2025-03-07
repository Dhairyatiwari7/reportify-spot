
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Camera, Upload, Loader2, MapPin } from "lucide-react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import MapComponent from "@/components/MapComponent";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { createHazardReport } from "@/services/hazardService";
import { v4 as uuidv4 } from "uuid";

const formSchema = z.object({
  description: z
    .string()
    .min(10, { message: "Description must be at least 10 characters" })
    .max(500, { message: "Description must not exceed 500 characters" }),
  address: z.string().min(5, { message: "Please provide a valid address" }),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  image: z.instanceof(File).optional(),
  hazardType: z.string().optional(),
});

// GitHub repository configuration
const GITHUB_CONFIG = {
  USERNAME: "Dhairyatiwari7",
  REPO_NAME: "images",
  BRANCH: "master",
  TOKEN: "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", 
};

const ReportPage = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hazardType, setHazardType] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      address: "",
      hazardType: "",
    },
  });

  useEffect(() => {
    if (!user) {
      toast.error("Please log in to report a hazard");
      navigate("/login");
    }
  }, [user, navigate]);

  // Fetch user's live location on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      setIsFetchingLocation(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          form.setValue("latitude", latitude);
          form.setValue("longitude", longitude);
          
          // Get address from coordinates using reverse geocoding
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const data = await response.json();
            if (data.display_name) {
              form.setValue("address", data.display_name);
              toast.success("Location detected successfully");
            }
          } catch (error) {
            console.error("Error fetching address:", error);
          } finally {
            setIsFetchingLocation(false);
          }
        },
        (error) => {
          console.error("Error fetching location:", error);
          toast.error("Unable to fetch your location. Please enable location services.");
          setIsFetchingLocation(false);
        }
      );
    } else {
      toast.error("Geolocation is not supported by your browser.");
    }
  }, []);

  // Function to detect hazard using Roboflow API
  const detectHazard = async (imageUrl: string) => {
    try {
      console.log("Calling Roboflow API with image URL:", imageUrl);
      setIsAnalyzingImage(true);

      const response = await fetch('https://detect.roboflow.com/infer/workflows/urbanfix/custom-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: 'j3C8g5q9c8vXk1FyhV1s',
          inputs: { "image": { "type": "url", "value": imageUrl } }
        })
      });

      if (!response.ok) {
        throw new Error(`Roboflow API returned ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("Roboflow API response:", result);

      const classNames = result.outputs[0]?.model_predictions?.predictions.map(prediction => prediction.class) || [];
      const detectedHazard = classNames.length > 0 ? classNames.join(", ") : "Nothing detected";
      
      // Set the hazard type in the form
      setHazardType(detectedHazard);
      form.setValue("hazardType", detectedHazard);
      
      // Show a toast notification with the detected hazard
      toast.success(`Hazard detected: ${detectedHazard}`);
      
      return detectedHazard;
    } catch (error) {
      console.error("Error detecting hazard:", error);
      toast.error("Failed to analyze image. Please try again.");
      return "Unknown";
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  // Function to upload image to GitHub and get public URL
  const uploadImage = async (file: File) => {
    const { USERNAME, REPO_NAME, BRANCH, TOKEN } = GITHUB_CONFIG;
    
    // Generate a unique filename to avoid conflicts
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    
    console.log("Preparing to upload image to GitHub...");
    
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          // Extract base64 content from the FileReader result
          const base64Content = reader.result?.toString().split(',')[1];
          
          if (!base64Content) {
            throw new Error("Failed to read file content");
          }
          
          console.log("Uploading image to GitHub repository...");
          
          const response = await fetch(`https://api.github.com/repos/${USERNAME}/${REPO_NAME}/contents/${fileName}`, {
            method: "PUT",
            headers: {
              "Authorization": `token ${TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: `Upload hazard image: ${fileName}`,
              content: base64Content,
              branch: BRANCH,
            }),
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            console.error("GitHub API error:", data);
            throw new Error(data.message || "Failed to upload to GitHub");
          }
          
          // Generate the raw content URL for the uploaded file
          const imageUrl = `https://raw.githubusercontent.com/${USERNAME}/${REPO_NAME}/${BRANCH}/${fileName}`;
          console.log("Image uploaded to GitHub. URL:", imageUrl);
          
          resolve(imageUrl);
        } catch (error) {
          console.error("Error in GitHub upload:", error);
          reject(error);
        }
      };
      
      reader.onerror = (error) => {
        console.error("Error reading file:", error);
        reject(new Error("Failed to read file"));
      };
      
      reader.readAsDataURL(file);
    });
  };

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast.error("You must be logged in to submit a report");
      navigate("/login");
      return;
    }
  
    setIsSubmitting(true);
  
    try {
      let imageUrl = null;
  
      if (values.image) {
        console.log("Processing image...");
        toast.info("Uploading image to GitHub...");
        imageUrl = await uploadImage(values.image);
      }
  
      // Ensure we have all required data
      if (!values.latitude || !values.longitude) {
        throw new Error("Location coordinates are required");
      }
  
      // Create the location object
      const location = {
        lat: Number(values.latitude), // Ensure lat is a number
        lng: Number(values.longitude), // Ensure lng is a number
        address: values.address
      };
  
      // Use the hazardType from the form, defaulting to "other" if empty
      const hazardType = values.hazardType || "other";
  
      // Call the createHazardReport function with proper parameters
      const report = await createHazardReport(
        hazardType,
        values.description,
        location,
        user.id,
        imageUrl
      );
  
      if (!report) {
        throw new Error("Failed to create report");
      }
  
      toast.success("Hazard reported successfully! You've earned 10 tokens!");
      navigate("/map");
    } catch (error: any) {
      console.error("Report error:", error);
      toast.error(error.message || "There was an error submitting your report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle image upload with immediate hazard detection
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should not exceed 5MB");
      return;
    }

    form.setValue("image", file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload image immediately for hazard detection
    try {
      toast.info("Uploading and analyzing image...");
      const imageUrl = await uploadImage(file);
      await detectHazard(imageUrl);
    } catch (error: any) {
      console.error("Error processing image:", error);
      toast.error(error.message || "Error processing image");
    }
  };

  // Handle location selection on the map
  const handleLocationSelect = (location: { lat: number; lng: number; address: string }) => {
    form.setValue("latitude", location.lat);
    form.setValue("longitude", location.lng);
    form.setValue("address", location.address);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pb-16 pt-6 sm:px-6 animate-fade-in">
        <div className="w-full mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-4">Report a Hazard</h1>
          <p className="text-muted-foreground">
            Help keep your community safe by reporting public hazards
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <Card className="mb-6 overflow-hidden">
              <CardContent className="p-0">
                <div className="h-[300px]">
                  <MapComponent
                    showControls={true}
                    onSelectLocation={handleLocationSelect}
                    readOnly={false}
                    initialLocation={userLocation}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="bg-muted/30 rounded-lg p-4 border border-border">
              <h3 className="font-medium mb-2 flex items-center">
                <MapPin size={16} className="mr-2 text-primary" />
                Location Details
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                {isFetchingLocation ? 
                  "Fetching your location..." : 
                  "Click on the map or use the locate button to select the hazard location"}
              </p>

              {form.watch("address") && (
                <div className="bg-white p-3 rounded-md border border-border">
                  <div className="text-sm font-medium">Selected Location</div>
                  <div className="text-sm text-muted-foreground">
                    {form.watch("address")}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="hazardType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hazard Type</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder={isAnalyzingImage ? "Analyzing image..." : "Upload an image to detect hazard type"}
                            {...field}
                            value={hazardType || field.value}
                            readOnly
                            className={isAnalyzingImage ? "pr-10" : ""}
                          />
                          {isAnalyzingImage && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <Loader2 size={16} className="animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>
                        {hazardType ? 
                          "Hazard type detected from image" : 
                          "Upload an image to automatically detect the hazard type"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the hazard in detail..."
                          {...field}
                          className="min-h-[120px]"
                        />
                      </FormControl>
                      <FormDescription>
                        Provide details about the hazard, its severity, and any other relevant information
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            placeholder={isFetchingLocation ? "Detecting your location..." : "Address or location description"} 
                            {...field} 
                            className={isFetchingLocation ? "pr-10" : ""}
                          />
                          {isFetchingLocation && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <Loader2 size={16} className="animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>
                        {isFetchingLocation ? 
                          "Detecting your location automatically..." : 
                          "The address will be automatically filled when you select a location on the map"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="image"
                  render={({ field: { value, onChange, ...field } }) => (
                    <FormItem>
                      <FormLabel>Upload Image</FormLabel>
                      <FormControl>
                        <div className="flex flex-col space-y-3">
                          <div className="flex items-center">
                            <Input
                              id="image"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageChange}
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => document.getElementById("image")?.click()}
                              className="mr-2"
                              disabled={isAnalyzingImage}
                            >
                              {isAnalyzingImage ? (
                                <Loader2 size={16} className="mr-2 animate-spin" />
                              ) : (
                                <Upload size={16} className="mr-2" />
                              )}
                              {isAnalyzingImage ? "Analyzing..." : "Select Image"}
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              {value?.name || "No file selected"}
                            </span>
                          </div>

                          {imagePreview && (
                            <div className="relative h-48 w-full overflow-hidden rounded-md border border-border">
                              <img
                                src={imagePreview}
                                alt="Preview"
                                className="h-full w-full object-cover"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 h-8 w-8"
                                onClick={() => {
                                  setImagePreview(null);
                                  form.setValue("image", undefined);
                                  setHazardType(null);
                                  form.setValue("hazardType", "");
                                }}
                                disabled={isAnalyzingImage}
                              >
                                &times;
                              </Button>
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>
                        Upload an image to automatically detect the hazard type (max size: 5MB)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isSubmitting || !form.formState.isValid || isAnalyzingImage || isFetchingLocation}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Hazard Report"
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ReportPage;
