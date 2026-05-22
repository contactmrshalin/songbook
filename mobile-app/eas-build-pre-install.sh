#!/bin/bash

# Remove workspaces from root package.json so npm installs deps directly
# in mobile-app/node_modules/ instead of hoisting to workspace root.
# The "platform" workspace is excluded from EAS upload via .easignore,
# which causes npm workspace resolution to fail.

set -eo pipefail

if [ -f ../package.json ]; then
  echo "Removing workspaces config from root package.json for EAS build..."
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('../package.json', 'utf8'));
    delete pkg.workspaces;
    fs.writeFileSync('../package.json', JSON.stringify(pkg, null, 2));
  "
  echo "Done. npm will install mobile-app deps locally."
fi
