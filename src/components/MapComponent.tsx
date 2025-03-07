
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Locate, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Hazard, HazardType } from "./HazardCard";

interface Location {
  lat: number;
  lng: number;
  address: string;
}

interface MapComponentProps {
  hazards?: Hazard[];
  onSelectLocation?: (location: Location) => void;
  onMarkerClick?: (hazard: Hazard) => void;
  showControls?: boolean;
  readOnly?: boolean;
  initialLocation?: { lat: number; lng: number };
}

// Add the missing infoWindow property to the Google Maps Marker type
declare global {
  interface Window {
    google: typeof google;
  }
  
  namespace google.maps {
    interface Marker {
      infoWindow?: google.maps.InfoWindow;
    }
  }
}

const MapComponent: React.FC<MapComponentProps> = ({
  hazards = [],
  onSelectLocation,
  onMarkerClick,
  showControls = true,
  readOnly = false,
  initialLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const googleMapsApiKey = import.meta.env.VITE_MAP_API_KEY;


  // Load Google Maps API
  useEffect(() => {
    const loadGoogleMapsAPI = () => {
      if (window.google && window.google.maps) {
        initializeMap();
        return;
      }
  
      const existingScript = document.getElementById("google-maps");
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "google-maps";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = initializeMap;
        script.onerror = () => console.error("Failed to load Google Maps API");
        document.head.appendChild(script);
      } else {
        existingScript.onload = initializeMap;
      }
    };
  
    loadGoogleMapsAPI();
  
    return () => {
      // Clean up markers when component unmounts
      markersRef.current.forEach(marker => marker.setMap(null));
    };
  }, []);
  
  // Initialize map
  const initializeMap = () => {
    if (!mapContainerRef.current || !window.google) return;

    const defaultLocation = { lat: 40.7128, lng: -74.006 }; // New York by default
    const mapOptions: google.maps.MapOptions = {
      center: initialLocation || defaultLocation,
      zoom: 14,
      mapTypeControl: true,
      fullscreenControl: true,
      streetViewControl: true,
      zoomControl: true,
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "on" }],
        },
      ],
    };

    const newMap = new google.maps.Map(mapContainerRef.current, mapOptions);
    setMap(newMap);

    if (initialLocation) {
      setCurrentLocation({
        ...initialLocation,
        address: "Loading address...",
      });
      
      // Reverse geocode the initial location
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { location: initialLocation },
        (results, status) => {
          if (status === "OK" && results && results[0]) {
            setCurrentLocation({
              ...initialLocation,
              address: results[0].formatted_address,
            });
          }
        }
      );
      
      // Add marker for initial location
      new google.maps.Marker({
        position: initialLocation,
        map: newMap,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "hsl(var(--primary))",
          fillOpacity: 1,
          strokeColor: "white",
          strokeWeight: 2,
        },
      });
    }

    // Add click listener for selecting location
    if (!readOnly) {
      newMap.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        
        const latLng = e.latLng.toJSON();
        handleMapClick(latLng);
      });
    }

    // Add hazard markers
    addHazardMarkers(newMap);
  };

  // Handle map clicks and reverse geocode to get address
  const handleMapClick = (latLng: google.maps.LatLngLiteral) => {
    if (readOnly || !map) return;

    // Clear existing user marker
    markersRef.current
      .filter(marker => marker.getTitle() === "Your selected location")
      .forEach(marker => marker.setMap(null));

    // Add marker at clicked location
    const marker = new google.maps.Marker({
      position: latLng,
      map: map,
      animation: google.maps.Animation.DROP,
      title: "Your selected location",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "hsl(var(--primary))",
        fillOpacity: 1,
        strokeColor: "white",
        strokeWeight: 2,
      },
    });
    
    markersRef.current.push(marker);

    // Get address using reverse geocoding
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode(
      { location: latLng },
      (results, status) => {
        if (status === "OK" && results && results[0]) {
          const location = {
            lat: latLng.lat,
            lng: latLng.lng,
            address: results[0].formatted_address,
          };
          
          setCurrentLocation(location);
          
          if (onSelectLocation) {
            onSelectLocation(location);
          }
          
          toast.success("Location selected successfully");
        } else {
          const location = {
            lat: latLng.lat,
            lng: latLng.lng,
            address: `${latLng.lat.toFixed(6)}, ${latLng.lng.toFixed(6)}`,
          };
          
          setCurrentLocation(location);
          
          if (onSelectLocation) {
            onSelectLocation(location);
          }
          
          toast.info("Coordinates selected (address not found)");
        }
      }
    );
  };

  // Add markers for hazards
  const addHazardMarkers = (mapInstance: google.maps.Map) => {
    // Clean existing markers first
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    hazards.forEach((hazard) => {
      if (!hazard.location?.lat || !hazard.location?.lng) return;
      
      // Define marker color based on hazard type
      const getMarkerColor = (type: HazardType) => {
        switch (type) {
          case "pothole": return "#ef4444"; // red
          case "waterlogging": return "#3b82f6"; // blue
          case "other": return "#f97316"; // orange
          default: return "#6b7280"; // gray
        }
      };

      const marker = new google.maps.Marker({
        position: { lat: hazard.location.lat, lng: hazard.location.lng },
        map: mapInstance,
        title: hazard.description,
        animation: google.maps.Animation.DROP,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: getMarkerColor(hazard.type),
          fillOpacity: 0.9,
          strokeColor: "white",
          strokeWeight: 2,
        },
      });

      // Create an info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="max-width: 200px; padding: 5px;">
            <div style="font-weight: bold; margin-bottom: 5px;">${hazard.description}</div>
            <div style="font-size: 0.875rem; color: #4b5563;">
              Reported by: ${hazard.reportedBy}
            </div>
            <div style="font-size: 0.875rem; color: #4b5563;">
              Status: ${hazard.status.charAt(0).toUpperCase() + hazard.status.slice(1)}
            </div>
          </div>
        `,
      });

      // Add click listener for marker
      marker.addListener("click", () => {
        // Close all open info windows
        markersRef.current.forEach((m) => {
          if (m.infoWindow) m.infoWindow.close();
        });
        
        // Open this info window
        infoWindow.open(mapInstance, marker);
        
        // Save reference to open info window
        marker.infoWindow = infoWindow;
        
        // Call the onMarkerClick callback if provided
        if (onMarkerClick) {
          onMarkerClick(hazard);
        }
      });

      markersRef.current.push(marker);
    });
  };

  // Get user's current location
  const getUserLocation = () => {
    setIsLoading(true);
    
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      setIsLoading(false);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const latLng = { lat: latitude, lng: longitude };
        
        // Center map on user location
        if (map) {
          map.setCenter(latLng);
          map.setZoom(16);
        }
        
        // Set marker and get address
        handleMapClick(latLng);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        toast.error("Unable to retrieve your location. Please check your location permissions.");
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Update markers when hazards change or map is initialized
  useEffect(() => {
    if (map) {
      addHazardMarkers(map);
    }
  }, [hazards, map]);

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden border border-border">
      {/* Map container */}
      <div 
        ref={mapContainerRef}
        className="absolute inset-0 bg-blue-50"
      />
      
      {/* Loading overlay */}
      {!map && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-50/50">
          <div className="glass-panel p-4 rounded-lg max-w-md text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <h3 className="text-lg font-medium mb-2">Loading Map</h3>
            <p className="text-sm text-muted-foreground">
              Please wait while we load the interactive map...
            </p>
          </div>
        </div>
      )}
      
      {/* Controls */}
      {showControls && (
        <div className="absolute top-4 right-4 flex flex-col space-y-2">
          <Button 
            variant="secondary" 
            size="icon" 
            onClick={getUserLocation}
            disabled={isLoading}
            className="shadow-md"
          >
            {isLoading ? (
              <span className="animate-spin">
                <Locate size={18} />
              </span>
            ) : (
              <Locate size={18} />
            )}
          </Button>
        </div>
      )}
      
      {/* Map attribution */}
      <div className="absolute bottom-1 right-1 bg-white/80 px-2 py-1 rounded text-xs text-muted-foreground">
        Map data © Google Maps
      </div>
    </div>
  );
};

export default MapComponent;
