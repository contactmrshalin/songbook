#!/bin/bash

# Remove root package.json and package-lock.json so npm treats mobile-app
# as a standalone project and installs all deps in mobile-app/node_modules/.
# Without this, npm detects the workspace root and hoists deps there,
# making them unresolvable from mobile-app.

set -eo pipefail

echo "EAS pre-install: isolating mobile-app from workspace root..."

# Delete root package.json and lockfile so npm won't detect a workspace
rm -f ../package.json ../package-lock.json

echo "Done. npm will install mobile-app deps in ./node_modules/."
