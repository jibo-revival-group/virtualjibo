#!/bin/sh

# Run this script after any logic that needs to write to read only folders on a robot.
# It ensures mounts that should to be read-only are returned to that read-only state
# See related `mount-rw.sh` script.
robotHost=`./bin/utils/get-robot-host.sh $1`;

echo "Ensuring appropriate folders are reverted to read only...";
	# ( || true ) Ignore errors, jibo-mount may not available on the robot
ssh root@$robotHost 'jibo-mount --ro' 2> /dev/null || true
