#!/bin/bash

# PWA Asset Generator for Goga_Network
# This script generates all necessary PWA assets from logo.png
# 
# Usage: bash generate-pwa.sh
# Or make it executable: chmod +x generate-pwa.sh && ./generate-pwa.sh

set -e

LOGO="logo.png"
BG_COLOR="#9f1239"

echo "🚀 PWA Asset Generator for Goga_Network"
echo "========================================"

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick not found. Installing..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y imagemagick
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install imagemagick
    else
        echo "Please install ImageMagick manually: https://imagemagick.org/script/download.php"
        exit 1
    fi
fi

# Check if logo.png exists
if [ ! -f "$LOGO" ]; then
    echo "❌ logo.png not found in current directory!"
    exit 1
fi

echo "✓ Found logo.png"

# Create directories
mkdir -p public/icons
mkdir -p public/apple-splash
mkdir -p public/screenshots

echo "✓ Created directories"

# Generate Icons
echo ""
echo "📱 Generating PWA Icons..."

for size in 72 96 128 144 152 180 192 384 512; do
    convert "$LOGO" -resize ${size}x${size} -background none -gravity center -extent ${size}x${size} "public/icons/icon-${size}x${size}.png"
    echo "  ✓ icon-${size}x${size}.png"
done

# Generate maskable icon with padding
convert "$LOGO" -resize 352x352 -background "$BG_COLOR" -gravity center -extent 512x512 "public/icons/maskable-icon-512x512.png"
echo "  ✓ maskable-icon-512x512.png"

# Generate Apple touch icon
convert "$LOGO" -resize 180x180 -background none -gravity center -extent 180x180 "public/icons/apple-icon-180.png"
echo "  ✓ apple-icon-180.png"

# Generate Favicon
convert "$LOGO" -resize 32x32 -background none -gravity center -extent 32x32 "public/favicon.ico"
echo "  ✓ favicon.ico"

# Generate Apple Splash Screens
echo ""
echo "🖼️  Generating Apple Splash Screens..."

declare -a SPLASHES=(
    "2048:2732"
    "2732:2048"
    "1668:2388"
    "2388:1668"
    "1536:2048"
    "2048:1536"
    "1488:2266"
    "2266:1488"
    "1640:2360"
    "2360:1640"
    "1668:2224"
    "2224:1668"
    "1620:2160"
    "2160:1620"
    "1290:2796"
    "2796:1290"
    "1179:2556"
    "2556:1179"
    "1284:2778"
    "2778:1284"
    "1170:2532"
    "2532:1170"
    "1125:2436"
    "2436:1125"
    "1242:2688"
    "2688:1242"
    "828:1792"
    "1792:828"
    "1242:2208"
    "2208:1242"
    "750:1334"
    "1334:750"
    "640:1136"
    "1136:640"
)

count=0
for splash in "${SPLASHES[@]}"; do
    IFS=':' read -r width height <<< "$splash"
    
    # Calculate logo size (40% of shortest dimension)
    if [ $width -lt $height ]; then
        logo_size=$((width * 40 / 100))
    else
        logo_size=$((height * 40 / 100))
    fi
    
    convert -size ${width}x${height} xc:"$BG_COLOR" \
        \( "$LOGO" -resize ${logo_size}x${logo_size} -background none -gravity center \) \
        -gravity center -composite \
        "public/apple-splash/apple-splash-${width}-${height}.png"
    
    count=$((count + 1))
    if [ $((count % 5)) -eq 0 ]; then
        echo "  ✓ Generated $count/${#SPLASHES[@]} splash screens..."
    fi
done

echo "  ✓ Completed all ${#SPLASHES[@]} splash screens"

# Generate Screenshots
echo ""
echo "📸 Generating App Screenshots..."

# Mobile screenshot
convert -size 540x720 xc:"$BG_COLOR" \
    \( "$LOGO" -resize 200x200 -background none -gravity center \) \
    -gravity center -composite \
    "public/screenshots/app-preview-mobile.png"
echo "  ✓ app-preview-mobile.png"

# Desktop screenshot
convert -size 1280x720 xc:"$BG_COLOR" \
    \( "$LOGO" -resize 300x300 -background none -gravity center \) \
    -gravity center -composite \
    "public/screenshots/app-preview-desktop.png"
echo "  ✓ app-preview-desktop.png"

echo ""
echo "✅ PWA Assets Generated Successfully!"
echo ""
echo "Generated:"
echo "  • ${#SPLASHES[@]} Apple splash screens"
echo "  • 9 PWA icons"
echo "  • 1 maskable icon"
echo "  • 1 Apple touch icon"
echo "  • 2 app screenshots"
echo "  • 1 favicon"
echo ""
echo "Next steps:"
echo "1. Replace manifest.ts with the updated version"
echo "2. Replace layout.tsx with the updated version"
echo "3. Run: npm run build"
echo "4. Deploy your app"
echo ""
echo "🎉 Your PWA is ready!"