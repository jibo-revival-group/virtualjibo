#!/bin/sh

# Run this script before any logic that needs to write to read only folders on a robot
# See related `mount-ro.sh` script.
robotHost=`./bin/utils/get-robot-host.sh $1`;

echo "Ensuring appropriate folders are read/write...";
	# ( || true ) Ignore errors, jibo-mount may not available on the robot
ssh root@$robotHost 'jibo-mount --rw' 2> /dev/null || true

# Ensure mount has time to finish
sleep 2;
