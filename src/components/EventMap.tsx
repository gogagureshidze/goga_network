"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Map, { Marker } from "react-map-gl/maplibre";
import { useState, useEffect, useRef } from "react";
import { APIProvider, useMapsLibrary, useMap } from "@vis.gl/react-google-maps";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
interface EventMapProps {
  locationType: "current" | "future";
  onSelectLocation: (
    coords: { lat: number; lng: number },
    address: string
  ) => void;
}

// 🆕 This is a new, reusable component for the Autocomplete search bar
const PlaceAutocomplete = ({
  onPlaceSelect,
}: {
  onPlaceSelect: (place: google.maps.places.PlaceResult | null) => void;
}) => {
  const [placeAutocomplete, setPlaceAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const places = useMapsLibrary("places");

  useEffect(() => {
    if (!places || !inputRef.current) return;
    const options = {
      fields: ["geometry", "name", "formatted_address"],
      types: ["address"],
    };
    setPlaceAutocomplete(new places.Autocomplete(inputRef.current, options));
  }, [places]);

  useEffect(() => {
    if (!placeAutocomplete) return;

    const listener = placeAutocomplete.addListener("place_changed", () => {
      onPlaceSelect(placeAutocomplete.getPlace());
    });

    return () => {
      // Clean up the listener when the component unmounts
      google.maps.event.removeListener(listener);
    };
  }, [onPlaceSelect, placeAutocomplete]);

  return (
    <input
      type="text"
      ref={inputRef}
      placeholder="Search location..."
      className="p-3 border-2 border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all"
    />
  );
};

// 🆕 Main component now uses the new Autocomplete component
const EventMapContent: React.FC<EventMapProps> = ({
  locationType,
  onSelectLocation,
}) => {
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [address, setAddress] = useState("");
  const [viewState, setViewState] = useState({
    latitude: 51.5074,
    longitude: -0.1278,
    zoom: 2,
  });
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const map = useMap(); // 🆕 Get the map instance via a hook

  const handlePlaceSelect = (place: google.maps.places.PlaceResult | null) => {
    if (!place || !place.geometry || !place.geometry.location) {
      alert("No details available for this location.");
      return;
    }
    const coords = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };
    const displayAddr = place.formatted_address || place.name || "";
    setMarker(coords);
    setAddress(displayAddr);
    setViewState({ latitude: coords.lat, longitude: coords.lng, zoom: 15 });
    onSelectLocation(coords, displayAddr);
  };

  // 🔄 Updated useEffect for Current Location Reverse Geocoding
  useEffect(() => {
    if (locationType === "current" && navigator.geolocation) {
      setIsLoadingLocation(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setMarker(coords);
          setViewState({
            latitude: coords.lat,
            longitude: coords.lng,
            zoom: 15,
          });
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: coords }, (results, status) => {
            if (status === "OK" && results && results[0]) {
              const displayAddr = results[0].formatted_address;
              setAddress(displayAddr);
              onSelectLocation(coords, displayAddr);
            } else {
              console.error("Geocoding failed due to:", status);
              const displayAddr = "Current Location";
              setAddress(displayAddr);
              onSelectLocation(coords, displayAddr);
            }
          });
          setIsLoadingLocation(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          alert(
            "Could not get your current location. Please enable location services."
          );
          setIsLoadingLocation(false);
        }
      );
    }
  }, [locationType, onSelectLocation]);

  const handleMapClick = (evt: any) => {
    if (locationType !== "future") return;
    const coords = { lat: evt.lngLat.lat, lng: evt.lngLat.lng };
    setMarker(coords);
    setViewState({ latitude: coords.lat, longitude: coords.lng, zoom: 15 });
    onSelectLocation(
      coords,
      `Lat: ${coords.lat.toFixed(4)}, Lng: ${coords.lng.toFixed(4)}`
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {locationType === "future" && (
        <PlaceAutocomplete onPlaceSelect={handlePlaceSelect} />
      )}

      {isLoadingLocation && locationType === "current" && (
        <div className="flex items-center justify-center gap-2 p-3 bg-blue-50 rounded-lg">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="text-sm text-blue-600 font-medium">
            Getting your location...
          </span>
        </div>
      )}

      <div className="h-80 w-full rounded-2xl overflow-hidden shadow-xl border-2 border-gray-200 transition-all duration-300">
        <Map
          {...viewState}
          style={{ width: "100%", height: "100%" }}
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
          onMove={(evt) => setViewState(evt.viewState)}
          onClick={locationType === "future" ? handleMapClick : undefined}
        >
          {marker && (
            <Marker
              latitude={marker.lat}
              longitude={marker.lng}
              anchor="bottom"
            >
              <div className="relative animate-bounce">
                <div className="absolute -inset-2 bg-red-400 rounded-full opacity-50 animate-ping"></div>
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="relative"
                >
                  <path
                    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                    fill="#EF4444"
                    stroke="#DC2626"
                    strokeWidth="1"
                  />
                </svg>
              </div>
            </Marker>
          )}
        </Map>
      </div>

      {address && (
        <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200 animate-fadeIn">
          <p className="text-sm font-medium text-green-800">
            📍 <span className="font-semibold">Selected:</span> {address}
          </p>
        </div>
      )}
    </div>
  );
};

const EventMap: React.FC<EventMapProps> = (props) => {
  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY || ""}
      solutionChannel="GMP_QB_addressselection_v4_cABC"
    >
      <EventMapContent {...props} />
    </APIProvider>
  );
};

export default EventMap;
