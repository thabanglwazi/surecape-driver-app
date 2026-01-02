#!/bin/bash
echo "🚗 SureCape Driver App - Quick Start"
echo "======================================"
echo ""
if [ ! -s .env ] || ! grep -q "supabase.co" .env; then
    echo "⚠️  Please configure .env with Supabase credentials first!"
    exit 1
fi
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
fi
echo ""
echo "🚀 Starting Expo..."
npm start
