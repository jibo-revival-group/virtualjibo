#!/bin/sh

# Get the default robot's hostname from args or jibo cli
robotHost=`./bin/utils/get-robot-host.sh $1`;

# Open up the debugger page of the skills-service-manager
open http://$robotHost:12345
