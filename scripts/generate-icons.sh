#!/bin/bash
# Generate app icons from SkoolMate SVG logo
# Requires: ImageMagick (brew install imagemagick)

ICON_SVG="public/SkoolMate logos/SchoolMate icon.svg"
ANDROID_DIR="android/app/src/main/res"
IOS_DIR="ios/App/App/Assets.xcassets/AppIcon.appiconset"

echo "🎨 Generating SkoolMate OS app icons..."

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick not found. Install with: brew install imagemagick"
    exit 1
fi

# Generate Android icons
echo "📱 Android icons..."
declare -A ANDROID_SIZES=(
    ["mipmap-mdpi"]=48
    ["mipmap-hdpi"]=72
    ["mipmap-xhdpi"]=96
    ["mipmap-xxhdpi"]=144
    ["mipmap-xxxhdpi"]=192
)

for size_dir in "${!ANDROID_SIZES[@]}"; do
    size=${ANDROID_SIZES[$size_dir]}
    convert -background none -resize "${size}x${size}" "$ICON_SVG" \
        "$ANDROID_DIR/$size_dir/ic_launcher.png"
    convert -background none -resize "${size}x${size}" "$ICON_SVG" \
        "$ANDROID_DIR/$size_dir/ic_launcher_round.png"
    convert -background none -resize "${size}x${size}" "$ICON_SVG" \
        "$ANDROID_DIR/$size_dir/ic_launcher_foreground.png"
    echo "  ✓ $size_dir ($size x $size)"
done

# Generate iOS icon (512x512 @2x = 1024x1024)
echo "🍎 iOS icon..."
convert -background none -resize 1024x1024 "$ICON_SVG" \
    "$IOS_DIR/AppIcon-512@2x.png"
echo "  ✓ 1024x1024"

echo "✅ Done! Run 'npx cap sync' to update native projects."