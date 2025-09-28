#!/bin/bash
# Script to apply roleController refactoring
# Created: 27/09/2025 11:45

echo "Applying roleController refactoring..."

# Navigate to the controllers directory
cd /home/mgiurelli/sviluppo/moobee/BE_nodejs/src/controllers/project/

# Backup original file
if [ -f "roleController.js" ]; then
  echo "Creating backup of original file..."
  cp roleController.js roleController_original_backup.js
  echo "Backup created: roleController_original_backup.js"
fi

# Replace with refactored version
if [ -f "roleController_refactored.js" ]; then
  echo "Replacing with refactored version..."
  mv roleController.js roleController_old.js 2>/dev/null || true
  cp roleController_refactored.js roleController.js
  echo "Refactoring applied successfully!"
else
  echo "Error: roleController_refactored.js not found!"
  exit 1
fi

echo "Done! The refactored roleController.js is now in place."
echo "Original backup saved as: roleController_original_backup.js"