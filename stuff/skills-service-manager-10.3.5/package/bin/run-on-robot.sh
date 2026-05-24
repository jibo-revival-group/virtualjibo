#!/bin/sh

# Sync the skills service manager files over to the robot
./bin/on-robot/sync-to-robot.sh $*

# Stop any previous running skills, dev shell, or skills service manager processes
./bin/on-robot/stop-ssm.sh $*
