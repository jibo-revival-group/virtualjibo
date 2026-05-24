#!/bin/sh

# Utility script to fetch the current robot's hostname
# Uses the robot name passed from the command line
# If no command line arg is given, fetches the default robot name from jibo-cli
robotHost=${1:-`jibo robot-list|grep '*'|awk '{print \$3 }'`};
echo $robotHost;
