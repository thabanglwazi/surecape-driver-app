#!/bin/bash
# Start Expo without login prompt - use yes command to auto-select anonymous
export EXPO_NO_TELEMETRY=1
yes "2" | npx expo start --clear
