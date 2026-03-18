#!/bin/bash
echo "=================================================="
echo "🌤️  OpenWeather API Key Setup"
echo "=================================================="
echo ""
echo "To get your API key:"
echo "1. Go to: https://openweathermap.org/api"
echo "2. Sign up for free account"
echo "3. Go to 'API keys' section"
echo "4. Copy your API key"
echo ""
echo "=================================================="
echo ""
read -p "Enter your OpenWeather API key: " api_key
echo ""

if [ -z "$api_key" ]; then
    echo "❌ No API key provided. Using demo mode."
    api_key="DEMO_KEY_WILL_NOT_WORK"
fi

cd /home/smartmirror/Downloads/smart-mirror/backend
sed -i "s/OPENWEATHER_API_KEY=.*/OPENWEATHER_API_KEY=$api_key/" .env

echo "✅ API key saved to backend/.env"
echo ""
echo "You can now start the application!"
echo "Run: ./start-mirror.sh"
