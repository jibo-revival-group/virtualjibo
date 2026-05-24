#!/bin/sh

# This is called by package.js
#
# Packages up jibo-ssm for buildroot (assumes package.json version is set) and uploads it to repository.jibo.com
# Parameter is package.json version; assumes you have cd'd into skills-service-manager directory
# $1 === version (e.g. 1.0.1)
# $2 === ldap user for uploading to repository.jibo.com

# This creates a temp directory and yarn installs the specified ssm version

echo "\nCreating staged SSM install"
rm -rf .staged
node ../jibo-sync-stage/bin/sync-stage.js
echo "\nFinished creating staged install"

echo "\nTarring jibo-ssm"
tar -C .staged -czf jibo-ssm-$1.tar.gz .

echo "\nSaving shasum to ./jibo-ssm-sha\n"
shasum -a 256 jibo-ssm-$1.tar.gz > jibo-ssm-sha

echo "\nUploading to repository.jibo.com...\n"
scp jibo-ssm-$1.tar.gz $2@repository.jibo.com:/data001/www/sdk/jibo-ssm/

echo ""
echo "Slack Blair/Mehool:"
echo "---------------------------------------------"
echo "@blair, @mehool I just put up a new SSM ($1):\`\`\`"
echo "# Locally computed"
echo "sha256 `cat jibo-ssm-sha`"
echo ""
echo "Git Comment"
echo "JIBO-____: FIX: Update SSM ($1) on buildroot"
echo "\`\`\`"
echo "---------------------------------------------"
echo ""
echo "\nJira Title"
echo "Update SSM@$1"
echo ""
echo "\nJira Description"
echo "Add latest SSM@$1 to buildroot"
echo ""
