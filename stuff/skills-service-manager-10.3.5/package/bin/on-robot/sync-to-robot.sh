#!/bin/sh

# Parse the arguments to check for --no-ignores flag
# as well as an optional robots name
force=false
skipStage=false
for i in "$@"
do
case $i in
    --force)
    force=true
    shift
    ;;
    --skipStage)
    skipStage=true
    shift
    ;;
    *)
    robotName="${i}" # specified robot
    ;;
esac
done

# Syncs the skills-service-manager's code to a robot. It's copied to where it will be when it gets
# into buildroot
#

# Ensure ssm related folders are writeable
./bin/mount-rw.sh $robotName

# Get the default robot's hostname from args or jibo cli
robotHost=`./bin/utils/get-robot-host.sh $robotName`;

echo "\nSyncing jibo-ssm changes to $robotHost (force == $force | skipStage == $skipStage)\n"

if ! $skipStage ; then
    # Run SyncIgnore to generate a list of files
    syncStage=$(node ./bin/utils/resolve-sync.js);

    if $force ; then
        # Remove the existing staging folder
        node $syncStage --force
    else
        # Stage the assets
        node $syncStage
    fi
fi

if [ ! -d "./.staged" ]; then
    # No staged directory? Bail out with error
    echo "Error: Directory ./.staged does not exist. Stopping"
    exit 1
else
    # Stage the assets
    node $syncStage
fi

# Ensure ssm related folders are writeable
./bin/mount-rw.sh $robotHost

# Colorize the output
echo "\033[0;90m";

# Copy over stuff to /user/local/bin/jibo-ssm
remotePath=/usr/local/bin/jibo-ssm/
rsync --archive \
    --verbose \
    --checksum \
    --no-perms \
    --no-owner \
    --no-group \
    --delete \
    --force \
    ./.staged/ \
    root@$robotHost:$remotePath

# Copy necessary configs to /usr/local/etc/jibo-ssm
rsync --archive \
    --verbose \
    --checksum \
    --no-perms \
    --no-owner \
    --no-group \
    --delete \
    --include '*/' \
    --include 'jibo-ssm*.json' \
    --exclude '*' \
    ./configs/ \
    root@$robotHost:/usr/local/etc/jibo-ssm/


# Fix root ownership under /usr/local
ssh root@$robotHost 'chown -R root:root /usr/local/bin/jibo-ssm'
# ssh root@$robotHost 'chown -R root:root /usr/local/etc/jibo-ssm'
# Fix permissions for the skills main process

ssh root@$robotHost 'chmod -R go+rX /usr/local/bin/jibo-ssm'

echo "\n\033[0;32mDone.";

# Reset color
echo "\033[0m";

# Reset any ssm folders that should be, back to read-only
./bin/mount-ro.sh $robotHost
