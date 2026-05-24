#!/bin/sh

# Get the default robot's hostname from args or jibo cli
robotHost=`./bin/utils/get-robot-host.sh $1`;

# Ensure ssm related folders are writeable
./bin/mount-rw.sh $1

# Remove all SSM files off the robot, this will
# make it easier to do a first-time sync, especially
# if you transferring from NPM3 to NPM2
ssh root@$robotHost 'rm -rf /usr/local/bin/jibo-ssm/* /usr/local/etc/jibo-ssm/*'

# Reset any ssm folders that should be, back to read-only
./bin/mount-ro.sh $1
