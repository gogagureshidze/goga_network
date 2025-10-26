"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sun,
  Moon,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudDrizzle,
  CloudFog,
  Wind,
  Zap,
  CloudSun,
  Star,
  Droplets,
  Thermometer,
  Eye,
  Gauge,
  Navigation,
} from "lucide-react";

interface WeatherGreetingProps {
  userName?: string;
}

export default function WeatherGreeting({
  userName = "Friend",
}: WeatherGreetingProps) {
  const [timeOfDay, setTimeOfDay] = useState("");
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState("");
  const [colorTheme, setColorTheme] = useState(0);
  const [currentGreeting, setCurrentGreeting] = useState("");
  const [isTextVisible, setIsTextVisible] = useState(true);
  const greetingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weatherPhrase, setWeatherPhrase] = useState("");

  const colorThemes = [
    {
      gradient: "from-purple-400 via-pink-500 to-red-500",
      darkGradient: "from-purple-500 via-pink-400 to-red-400",
      bg: "from-purple-50 to-pink-50",
      darkBg: "from-purple-900/20 to-pink-900/20",
      accent: "purple",
      darkAccent: "purple-400",
      shadow: "shadow-purple-200",
      darkShadow: "shadow-purple-900/50",
    },
    {
      gradient: "from-cyan-400 via-blue-500 to-indigo-600",
      darkGradient: "from-cyan-400 via-blue-400 to-indigo-400",
      bg: "from-cyan-50 to-blue-50",
      darkBg: "from-cyan-900/20 to-blue-900/20",
      accent: "cyan",
      darkAccent: "cyan-400",
      shadow: "shadow-cyan-200",
      darkShadow: "shadow-cyan-900/50",
    },
    {
      gradient: "from-green-400 via-emerald-500 to-teal-600",
      darkGradient: "from-green-400 via-emerald-400 to-teal-400",
      bg: "from-green-50 to-teal-50",
      darkBg: "from-green-900/20 to-teal-900/20",
      accent: "emerald",
      darkAccent: "emerald-400",
      shadow: "shadow-emerald-200",
      darkShadow: "shadow-emerald-900/50",
    },
    {
      gradient: "from-orange-400 via-red-500 to-pink-600",
      darkGradient: "from-orange-400 via-red-400 to-pink-400",
      bg: "from-orange-50 to-pink-50",
      darkBg: "from-orange-900/20 to-pink-900/20",
      accent: "orange",
      darkAccent: "orange-400",
      shadow: "shadow-orange-200",
      darkShadow: "shadow-orange-900/50",
    },
    {
      gradient: "from-yellow-400 via-orange-500 to-red-500",
      darkGradient: "from-yellow-400 via-orange-400 to-red-400",
      bg: "from-yellow-50 to-orange-50",
      darkBg: "from-yellow-900/20 to-orange-900/20",
      accent: "yellow",
      darkAccent: "yellow-400",
      shadow: "shadow-yellow-200",
      darkShadow: "shadow-yellow-900/50",
    },
    {
      gradient: "from-indigo-400 via-purple-500 to-pink-500",
      darkGradient: "from-indigo-400 via-purple-400 to-pink-400",
      bg: "from-indigo-50 to-purple-50",
      darkBg: "from-indigo-900/20 to-purple-900/20",
      accent: "indigo",
      darkAccent: "indigo-400",
      shadow: "shadow-indigo-200",
      darkShadow: "shadow-indigo-900/50",
    },
    {
      gradient: "from-rose-400 via-fuchsia-500 to-purple-600",
      darkGradient: "from-rose-400 via-fuchsia-400 to-purple-400",
      bg: "from-rose-50 to-fuchsia-50",
      darkBg: "from-rose-900/20 to-fuchsia-900/20",
      accent: "rose",
      darkAccent: "rose-400",
      shadow: "shadow-rose-200",
      darkShadow: "shadow-rose-900/50",
    },
    {
      gradient: "from-blue-400 via-cyan-500 to-teal-500",
      darkGradient: "from-blue-400 via-cyan-400 to-teal-400",
      bg: "from-blue-50 to-cyan-50",
      darkBg: "from-blue-900/20 to-cyan-900/20",
      accent: "blue",
      darkAccent: "blue-400",
      shadow: "shadow-blue-200",
      darkShadow: "shadow-blue-900/50",
    },
  ];

  const greetings = {
    morning: [
      "Rise and shine",
      "Good morning",
      "Morning sunshine",
      "Wakey wakey",
      "Top of the morning",
      "Hey early bird",
      "Morning vibes",
      "Hello sunshine",
      "Bright morning",
      "Fresh start",
    ],
    afternoon: [
      "Good afternoon",
      "Hey there",
      "Afternoon vibes",
      "Mid-day greetings",
      "Sunny afternoon",
      "Hello",
      "Afternoon energy",
      "Day's looking good",
      "Peak hours",
      "Afternoon mood",
    ],
    evening: [
      "Good evening",
      "Evening vibes",
      "Sunset greetings",
      "Hey there",
      "Twilight hello",
      "Evening mood",
      "Golden hour",
      "Dusk greetings",
      "Evening magic",
      "Night's approaching",
    ],
    night: [
      "Good night",
      "Hey night owl",
      "Midnight greetings",
      "Late night vibes",
      "Starry hello",
      "Night energy",
      "Moon greetings",
      "After dark",
      "Nocturnal vibes",
      "Night mode on",
    ],
  };

  const weatherPhrases = {
    clear: [
      "Perfect weather today",
      "Crystal clear skies",
      "Beautiful day ahead",
      "Sunshine all day",
    ],
    cloudy: [
      "Clouds rolling in",
      "Overcast vibes",
      "Gray skies today",
      "Cloud cover above",
    ],
    rainy: [
      "Rain drops falling",
      "Umbrella weather",
      "Wet conditions",
      "Rainy mood",
    ],
    snowy: [
      "Snow is falling",
      "Winter wonderland",
      "White blanket outside",
      "Snowy scenes",
    ],
    foggy: [
      "Foggy atmosphere",
      "Misty morning",
      "Low visibility",
      "Mysterious fog",
    ],
    stormy: [
      "Storm brewing",
      "Thunder and lightning",
      "Wild weather",
      "Electric skies",
    ],
  };

  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  useEffect(() => {
    const randomTheme = Math.floor(Math.random() * colorThemes.length);
    setColorTheme(randomTheme);

    const hour = new Date().getHours();
    let tod = "";
    if (hour >= 5 && hour < 12) tod = "morning";
    else if (hour >= 12 && hour < 17) tod = "afternoon";
    else if (hour >= 17 && hour < 21) tod = "evening";
    else tod = "night";
    setTimeOfDay(tod);

    const greetingOptions =
      greetings[tod as keyof typeof greetings] || greetings.afternoon;
    setCurrentGreeting(greetingOptions[0]);

    let greetingIndex = 0;
    greetingIntervalRef.current = setInterval(() => {
      setIsTextVisible(false);

      setTimeout(() => {
        greetingIndex = (greetingIndex + 1) % greetingOptions.length;
        setCurrentGreeting(greetingOptions[greetingIndex]);
        setIsTextVisible(true);
      }, 300);
    }, 10000);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const response = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,apparent_temperature,pressure_msl,precipitation&timezone=auto`
            );
            const data = await response.json();

            const geoResponse = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
            );
            const geoData = await geoResponse.json();
            const city =
              geoData.address.city ||
              geoData.address.town ||
              geoData.address.village ||
              geoData.address.county ||
              "";
            const country = geoData.address.country || "";
            setLocation(city ? `${city}, ${country}` : country);

            setWeather(data.current);

            const code = data.current.weather_code;
            let phraseType = "clear";
            if (code <= 3) phraseType = code === 0 ? "clear" : "cloudy";
            else if (code <= 48) phraseType = "foggy";
            else if (code <= 67) phraseType = "rainy";
            else if (code <= 77) phraseType = "snowy";
            else if (code >= 95) phraseType = "stormy";

            const phrases =
              weatherPhrases[phraseType as keyof typeof weatherPhrases];
            setWeatherPhrase(
              phrases[Math.floor(Math.random() * phrases.length)]
            );

            setLoading(false);
          } catch (error) {
            console.error("Weather fetch failed:", error);
            setLoading(false);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          setLoading(false);
        }
      );
    } else {
      setLoading(false);
    }

    return () => {
      if (greetingIntervalRef.current) {
        clearInterval(greetingIntervalRef.current);
      }
    };
  }, []);

  const getWeatherDescription = (code: number) => {
    const descriptions: { [key: number]: string } = {
      0: "Clear skies",
      1: "Mostly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Foggy",
      48: "Depositing rime fog",
      51: "Light drizzle",
      53: "Moderate drizzle",
      55: "Dense drizzle",
      61: "Slight rain",
      63: "Moderate rain",
      65: "Heavy rain",
      71: "Slight snow",
      73: "Moderate snow",
      75: "Heavy snow",
      80: "Slight rain showers",
      81: "Moderate rain showers",
      82: "Violent rain showers",
      95: "Thunderstorm",
      96: "Thunderstorm with slight hail",
      99: "Thunderstorm with heavy hail",
    };
    return descriptions[code] || "Clear";
  };

  const getWeatherIcon = (code: number) => {
    if (code === 0) return timeOfDay === "night" ? Moon : Sun;
    if (code <= 2) return CloudSun;
    if (code <= 3) return Cloud;
    if (code <= 48) return CloudFog;
    if (code <= 57) return CloudDrizzle;
    if (code <= 67) return CloudRain;
    if (code <= 77) return CloudSnow;
    if (code <= 82) return CloudRain;
    if (code <= 86) return CloudSnow;
    return Zap;
  };

  const getWindDirection = (degrees: number) => {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return directions[Math.round(degrees / 45) % 8];
  };

  const theme = colorThemes[colorTheme];
  const WeatherIcon = weather ? getWeatherIcon(weather.weather_code || 0) : Sun;
  const TimeIcon =
    timeOfDay === "morning" || timeOfDay === "evening"
      ? Sun
      : timeOfDay === "night"
      ? Moon
      : Sun;

  return (
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-900 shadow-2xl border border-gray-100 dark:border-gray-700 transition-all duration-300">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className={`absolute -top-10 sm:-top-20 -right-10 sm:-right-20 w-48 h-48 sm:w-96 sm:h-96 bg-gradient-to-br ${theme.gradient} dark:${theme.darkGradient} opacity-10 dark:opacity-20 rounded-full blur-3xl animate-pulse`}
        />
        <div
          className={`absolute -bottom-10 sm:-bottom-20 -left-10 sm:-left-20 w-48 h-48 sm:w-96 sm:h-96 bg-gradient-to-tr ${theme.gradient} dark:${theme.darkGradient} opacity-10 dark:opacity-20 rounded-full blur-3xl animate-pulse`}
          style={{ animationDelay: "1s" }}
        />
      </div>

      <div className="relative z-10 p-4 sm:p-6 md:p-8 lg:p-12">
        {/* Live Clock - Top Right */}
        <div className="absolute top-4 sm:top-6 right-4 sm:right-6 flex items-center gap-2 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700">
          <TimeIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-gray-700 dark:text-gray-300 text-sm sm:text-base font-bold tabular-nums">
            {currentTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>

        {/* Header Section with Animated Greeting */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div
              className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-gradient-to-r ${theme.gradient} dark:${theme.darkGradient} animate-pulse shadow-lg dark:shadow-xl`}
            />
            <span className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>

          <h1
            className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-2 bg-gradient-to-r ${
              theme.gradient
            } dark:${
              theme.darkGradient
            } bg-clip-text text-transparent leading-tight break-words transition-all duration-300 drop-shadow-sm ${
              isTextVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-2"
            }`}
          >
            {currentGreeting}, {userName}
          </h1>

          {location && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 w-fit px-3 py-1.5 rounded-full">
              <Navigation className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="text-sm sm:text-base lg:text-lg font-medium truncate">
                {location}
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 sm:py-12">
            <div className="relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-gray-200 dark:border-gray-700 rounded-full" />
              <div
                className={`absolute inset-0 w-12 h-12 sm:w-16 sm:h-16 border-4 border-transparent border-t-purple-500 dark:border-t-purple-400 rounded-full animate-spin`}
              />
            </div>
          </div>
        ) : weather ? (
          <div className="space-y-6">
            {/* Weather Status Bar */}
            <div
              className={`p-4 rounded-2xl bg-gradient-to-r ${theme.bg} dark:${theme.darkBg} backdrop-blur-sm border border-gray-200 dark:border-gray-700 shadow-lg dark:shadow-2xl`}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-3 rounded-xl bg-gradient-to-br ${theme.gradient} dark:${theme.darkGradient} ${theme.shadow} dark:${theme.darkShadow} shadow-xl`}
                  >
                    <WeatherIcon
                      className="w-6 h-6 sm:w-8 sm:h-8 text-white"
                      strokeWidth={2}
                    />
                  </div>
                  <div>
                    <p className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">
                      {getWeatherDescription(weather.weather_code)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {weatherPhrase}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end items-baseline">
                  <span
                    className={`text-4xl sm:text-5xl font-black bg-gradient-to-r ${theme.gradient} dark:${theme.darkGradient} bg-clip-text text-transparent drop-shadow-lg`}
                  >
                    {Math.round(weather.temperature_2m)}°
                  </span>
                </div>
              </div>
            </div>

            {/* Enhanced Weather Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Feels Like */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:shadow-xl dark:hover:shadow-2xl dark:hover:border-gray-500 transition-all duration-300 group">
                <div className="flex items-center gap-2 mb-2">
                  <Thermometer
                    className={`w-5 h-5 text-${theme.accent}-500 dark:text-${theme.darkAccent} transition-colors`}
                  />
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                    Feels Like
                  </span>
                </div>
                <p
                  className={`text-2xl sm:text-3xl font-black bg-gradient-to-r ${theme.gradient} dark:${theme.darkGradient} bg-clip-text text-transparent drop-shadow-sm`}
                >
                  {Math.round(
                    weather.apparent_temperature || weather.temperature_2m
                  )}
                  °
                </p>
              </div>

              {/* Humidity */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:shadow-xl dark:hover:shadow-2xl dark:hover:border-gray-500 transition-all duration-300 group">
                <div className="flex items-center gap-2 mb-2">
                  <Droplets
                    className={`w-5 h-5 text-${theme.accent}-500 dark:text-${theme.darkAccent} transition-colors`}
                  />
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                    Humidity
                  </span>
                </div>
                <p
                  className={`text-2xl sm:text-3xl font-black bg-gradient-to-r ${theme.gradient} dark:${theme.darkGradient} bg-clip-text text-transparent drop-shadow-sm`}
                >
                  {weather.relative_humidity_2m}%
                </p>
              </div>

              {/* Wind */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:shadow-xl dark:hover:shadow-2xl dark:hover:border-gray-500 transition-all duration-300 group">
                <div className="flex items-center gap-2 mb-2">
                  <Wind
                    className={`w-5 h-5 text-${theme.accent}-500 dark:text-${theme.darkAccent} transition-colors`}
                  />
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                    Wind
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <p
                    className={`text-2xl sm:text-3xl font-black bg-gradient-to-r ${theme.gradient} dark:${theme.darkGradient} bg-clip-text text-transparent drop-shadow-sm`}
                  >
                    {Math.round(weather.wind_speed_10m)}
                  </p>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    km/h {getWindDirection(weather.wind_direction_10m)}
                  </span>
                </div>
              </div>

              {/* Pressure */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:shadow-xl dark:hover:shadow-2xl dark:hover:border-gray-500 transition-all duration-300 group">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge
                    className={`w-5 h-5 text-${theme.accent}-500 dark:text-${theme.darkAccent} transition-colors`}
                  />
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                    Pressure
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-gray-100">
                  {Math.round(weather.pressure_msl || 1013)}{" "}
                  <span className="text-xs font-normal text-gray-600 dark:text-gray-400">
                    hPa
                  </span>
                </p>
              </div>
            </div>

            {/* Visual Weather Dashboard */}
            <div
              className={`relative p-6 rounded-2xl bg-gradient-to-br ${theme.bg} dark:${theme.darkBg} border border-gray-200 dark:border-gray-700 shadow-lg dark:shadow-2xl`}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Temperature Gauge */}
                <div className="text-center">
                  <div className="relative inline-flex items-center justify-center">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        className="text-gray-200 dark:text-gray-700"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="url(#tempGradient)"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${
                          (Math.min(weather.temperature_2m + 10, 50) / 60) * 352
                        } 352`}
                        className="transition-all duration-1000"
                      />
                      <defs>
                        <linearGradient
                          id="tempGradient"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="100%"
                        >
                          <stop
                            offset="0%"
                            className="text-purple-500 dark:text-purple-400"
                          />
                          <stop
                            offset="100%"
                            className="text-pink-500 dark:text-pink-400"
                          />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Thermometer className="w-6 h-6 text-gray-500 dark:text-gray-400 mb-1" />
                      <span className="text-2xl font-black text-gray-800 dark:text-gray-100">
                        {Math.round(weather.temperature_2m)}°C
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-gray-600 dark:text-gray-400">
                    Temperature
                  </p>
                </div>

                {/* Humidity Gauge */}
                <div className="text-center">
                  <div className="relative inline-flex items-center justify-center">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        className="text-gray-200 dark:text-gray-700"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${
                          (weather.relative_humidity_2m / 100) * 352
                        } 352`}
                        className="text-blue-500 dark:text-blue-400 transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Droplets className="w-6 h-6 text-gray-500 dark:text-gray-400 mb-1" />
                      <span className="text-2xl font-black text-gray-800 dark:text-gray-100">
                        {weather.relative_humidity_2m}%
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-gray-600 dark:text-gray-400">
                    Humidity
                  </p>
                </div>

                {/* Wind Speed Gauge */}
                <div className="text-center">
                  <div className="relative inline-flex items-center justify-center">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        className="text-gray-200 dark:text-gray-700"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${
                          (Math.min(weather.wind_speed_10m, 50) / 50) * 352
                        } 352`}
                        className="text-emerald-500 dark:text-emerald-400 transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Wind className="w-6 h-6 text-gray-500 dark:text-gray-400 mb-1" />
                      <span className="text-2xl font-black text-gray-800 dark:text-gray-100">
                        {Math.round(weather.wind_speed_10m)}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        km/h
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-gray-600 dark:text-gray-400">
                    Wind Speed
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 sm:py-12">
            <div className="inline-flex items-center gap-3 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 px-6 py-4 rounded-2xl border border-gray-200 dark:border-gray-600 shadow-lg">
              <Navigation className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <p className="text-base sm:text-lg md:text-xl text-gray-700 dark:text-gray-300 font-medium">
                Enable location to see your weather ✨
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
