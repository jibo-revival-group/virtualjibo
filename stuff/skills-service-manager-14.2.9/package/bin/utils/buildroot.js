// Get current version of ssm
const path = require('path');
const version = (process.argv.length) > 3 ? process.argv[3] : require( path.resolve(__dirname, "../../package.json") ).version;
//console.log(version);
// First check that a name was supplied

let exampleCommand = '  yarn buildroot francois_laberge'
if ( process.argv.length <= 2) {
    console.log('Requires repository.jibo.com LDAP user name. ex: \n');
    console.log(`${exampleCommand}\n`);
    process.exit();
}
else if ( process.argv.length > 4) {
    console.log('There should only be 2 parameter passed.\n');
    console.log(`${exampleCommand}\n`);
    process.exit();
}

// Do most of the logic in bash here
const command = path.resolve(__dirname, 'buildroot.sh');

const spawn = require('child_process').spawn;
const buildrootProcess = spawn(command, [version, process.argv[2]], {stdio:'inherit'});

buildrootProcess.on('close', (code) => {
    if(code){
        console.log(`\nFailed with error code ${code}\n`)
    } else {
        console.log(`\nSuccessfully uploaded\nhttp://repository.jibo.com/sdk/jibo-ssm/jibo-ssm-${version}.tar.gz\n`);
    }
});
