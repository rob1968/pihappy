#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
PROJECT_DIR="/var/www/vhosts/yourdomain.com/httpdocs" # <-- ADJUST: Absolute path to your project root on the server
VENV_DIR="$PROJECT_DIR/venv"                         # <-- ADJUST: Path to your virtual environment
FRONTEND_DIR="$PROJECT_DIR/frontend"                 # <-- ADJUST: Path to your frontend directory
APP_SERVICE_NAME="myapp"                             # <-- ADJUST: Name of your systemd/supervisor service

# --- Deployment Steps ---

echo "Starting deployment..."

# 1. Navigate to the project directory
cd "$PROJECT_DIR"
echo "Changed directory to $PROJECT_DIR"

# 2. Activate virtual environment
#    (Important: source might behave differently depending on how the script is run.
#     Alternatively, call python/pip directly using the venv path)
# source "$VENV_DIR/bin/activate"
# echo "Activated virtual environment (using source)"
# OR use direct paths (often more reliable in scripts):
PYTHON_EXEC="$VENV_DIR/bin/python"
PIP_EXEC="$VENV_DIR/bin/pip"
echo "Using Python from $PYTHON_EXEC"

# 3. Install/Update Python dependencies
echo "Installing/Updating Python dependencies..."
"$PIP_EXEC" install -r requirements.txt

# 4. Navigate to the frontend directory
echo "Changing directory to $FRONTEND_DIR"
cd "$FRONTEND_DIR"

# 5. Install/Update Node.js dependencies
echo "Installing/Updating Node.js dependencies..."
# Make sure npm is in the PATH or provide the full path if needed
npm install

# 6. Build the frontend application
echo "Building frontend application..."
npm run build # Assumes your build script is named 'build' in package.json

# 7. Navigate back to the project root
echo "Changing back to $PROJECT_DIR"
cd "$PROJECT_DIR"

# 8. Restart the application server (Gunicorn/uWSGI)
#    This requires the script runner (e.g., the Plesk user) to have
#    permission to restart the service (often requires sudo).
#    You might need to configure passwordless sudo for specific commands
#    if running this via Plesk without root privileges.
echo "Restarting application service ($APP_SERVICE_NAME)..."
# Check if systemctl exists (for systemd)
if command -v systemctl &> /dev/null; then
    sudo systemctl restart "$APP_SERVICE_NAME.service" # Add .service suffix if needed
# Check if supervisorctl exists
elif command -v supervisorctl &> /dev/null; then
    sudo supervisorctl restart "$APP_SERVICE_NAME"
else
    echo "Warning: Could not find systemctl or supervisorctl to restart the service."
    echo "You may need to restart the application manually."
fi

echo "Deployment finished successfully!"

exit 0