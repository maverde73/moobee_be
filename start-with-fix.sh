#!/bin/bash

# Script per avviare il backend con il fix per la conversione degli ID
# Questo risolve il problema degli endpoint che ricevono ID come string

echo "🚀 Starting Moobee Backend with ID conversion fix..."
NODE_OPTIONS="-r ./prisma-proxy.js" npm start