#!/bin/sh

# Get the default robot's hostname
robotHost=`./bin/utils/get-robot-host.sh`;

# Ensure ssm related folders are writeable
./bin/mount-rw.sh

# Copy the public ssh key onto a robot and put it into the robot's authorized_keys file
echo "Adding ssh key to ${robotHost}'s ~/.ssh/authorized_keys file (WARNING, this will be added multiple times if repeatedly called)"
cat ~/.ssh/id_rsa.pub | ssh root@${robotHost} "mkdir -p ~/.ssh && cat >>  ~/.ssh/authorized_keys"

# Reset any ssm folders that should be, back to read-only
./bin/mount-ro.sh
