#!/bin/sh

echo "\nBuilding /.staged for jibo-ssm...\n"

# Parse the arguments to check for --no-ignores flag
# as well as an optional robots name
force=false
for i in "$@"
do
case $i in
    --force)
    force=true
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

# Run SyncIgnore to generate a list of files
syncStage=$(node ./bin/utils/resolve-sync.js);

# Remove the existing staging folder
if $force ; then
    # Remove the existing staging folder
    node $syncStage --force
else
    # Stage the assets
    node $syncStage
fi

# Reset color
echo "\033[0m";

