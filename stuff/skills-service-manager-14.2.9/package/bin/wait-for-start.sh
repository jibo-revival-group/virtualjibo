#!/bin/sh

# Get the default robot's hostname from args or jibo cli
if [[ -z `which jibo` ]]; then
    echo "Failed to find jibo cli; did you forget to link it?"
    exit 1
fi
robotHost=`./bin/utils/get-robot-host.sh $robotName`;
if [[ -z $robotHost ]]; then
    echo "Failed to get default robot; did you forget to add one?"
    exit 2
fi

# Ensure we can connect to the robot
ssh -q -o ConnectTimeout=2 root@$robotHost exit
if [[ $? != 0 ]]; then
    echo "Cannot connect to $robotHost"
    exit 3
fi

while
    runningProcess=`ssh root@$robotHost ps -ef | grep [^]]jibo-ssm.js`
    [[ -z $runningProcess ]]
do
    continue
done

while
    jibo build-version 2>&1 >/dev/null
    [[ $? != 0 ]]
do
    continue
done
