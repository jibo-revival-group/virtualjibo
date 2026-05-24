#!/bin/sh

# Parse the arguments to check for --no-ignores flag
# as well as an optional robots name
for i in "$@"
do
case $i in
    --force)
    shift
    ;;
    --skipStage)
    shift
    ;;
    *)
    robotName="${i}" # specified robot
    ;;
esac
done

# Get the default robot's hostname from args or jibo cli
robotHost=`./bin/utils/get-robot-host.sh $robotName`;

# Stops any running skill
echo "Stopping SSM and any running skill(s)...";
ssh root@$robotHost 'killall electron';
ssh root@$robotHost 'pkill -f "/usr/bin/node --inspect=10225 /usr/local/bin/jibo-ssm/jibo-mms.js"';
ssh root@$robotHost 'pkill -f "/usr/bin/node --inspect=10224 /usr/local/bin/jibo-ssm/jibo-expression.js"';
ssh root@$robotHost 'pkill -f "/usr/bin/node --inspect=10223 /usr/local/bin/jibo-ssm/jibo-ssm.js"';
echo "System Manager is restarting the SSM";
