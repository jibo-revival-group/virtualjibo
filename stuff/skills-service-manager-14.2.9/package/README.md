## Skills Service Manager

The Skills Service Manager (SSM) implements skill switching (life cycle events), global listen, splash screens, and notifications services. These are all implemented in Javascript and appear in the service registry alongside C/C++ based services on the robot. The SSM is launched when running skills locally, remotely, and on robot.

**These instructions are ONLY for running the SSM on a robot OR for folks CONTRIBUTING to the skills service manager. If you just want to USE the SSM and/or run skills in the simulator, see instructions [here](https://confluence.jibo.com/display/SKIL/How+to+Add+Skills+to+Be+and+Run+the+SSM).**

## Update latest SSM on your robot
1. Get the latest SSM on your computer
  2. If you are using github, then run this from your skill-service-manager location:

    ```
     git checkout master
     rm -rf node_modules
     rm -rf lib   
     yarn install
     gulp debug
     ```
  2. If you are NOT using github, then run this on your computer:

    ```
     (First Time Only) create new directory on your computer where you will yarn install SSM, like ~/npm
     cd into your npm directory (~/npm or whatever)
     rm -rf node_modules/skills-service-manager
     yarn install skills-service-manager
     ```
2. Sync latest SSM on your robot
     ```
     cd into your updated skills-service-manager directory on robot
     run bin/run-on-robot.sh <--force> <--skipStage> <robotName>
        --force: optional argument to rebuilding (clean/build) your .staged directory (does not work with --skipStage)
        --skipStage: optional argument that uses an existing .staged directory to sync and not will not be staging ssm (overrides --force if specified)  
        <robotName>: optional argument to specify a robot in your jibo cli robot-list (by default uses your default robot in your jibo cli robot-list)
     ```  



## Setup

1.  Clone the Skills Service Manager

         git clone git@github.jibo.com:sdk/skills-service-manager.git
         cd skills-service-manager
         git checkout dev

2.  Robot Setup (Required if you are going to run things on the robot)
   1. run `jibo build-version` to see which version your robot is on. Only >=v1.1.10 is supported for SSM.
   1. To add your SSH key to the robot, from the `ssm` root run: `./bin/utils/add-ssh-key.sh`
1.  You need to customize one file to your environment for testing simulated builds (**unfortunately this file is currently checked in. So change it, but try not to commit it unless you are making changes to other settings**). In `skills-service-manager/configs/remote.json`, set the skillsBaseDir to where the skill(s) you want to test with the skills-service-manager live. Ex. `"skillsBaseDir": "/Users/francoislaberge/jibo/skills",`
1. Getting your code yarn linked, checking out the correct branches, and building it all:
  1. From `jibo`'s root run: (If you don't have `jibo` cloned, [the repo is here](https://github.jibo.com/sdk/jibo))

    ```
     git checkout dev
     yarn install
     gulp watch
     ```
  1. From `skills-service-manager`'s root, run: (If you don't have `skills-service-manager` cloned, [the repo is here](https://github.jibo.com/sdk/skills-service-manager))

     ```
     git checkout dev
     yarn link jibo
     yarn install
     gulp watch
     ```
  1. From `jibo`'s root, run: `yarn link skills-service-manager`
  1. From `jibo-cli`'s root, run: (If you don't have `jibo-cli` cloned, [the repo is here](https://github.jibo.com/sdk/jibo-cli))

     ```
     git checkout dev
     yarn link skills-service-manager
     yarn install
     gulp watch
     ```
   1. (Optional): To use Atom to launch skills do the following, from `jibo-sdk`'s root, run:

            ```
            git checkout master
            yarn link jibo-cli
            yarn link jibo
            yarn install
            apm link .
            gulp watch
            ```
   1. For any skill you want to test with the skills service manager, you must run `yarn link jibo` from its root.


## Running the Skills Service Manager

### On Robot

**IMPORTANT:** In order to test skill switching you need to `yarn sync` each skill to the robot before running the skill service manager.

**Run from the `skills-service-manager` root:**

  1. Run the skills service manager on the robot. (This syncs any changes made to the ssm, and kills any running dev-shell, ssm, or skill processes)

   ```bash
   run bin/run-on-robot.sh --force --skipStage <robotName>
        --force: optional argument to rebuilding (clean/build) your .staged directory (does not work with --skipStage)
        --skipStage: optional argument that uses an existing .staged directory to sync and not will not be staging ssm (overrides --force if specified)  
        <robotName>: optional argument to specify a robot in your jibo cli robot-list (by default uses your default robot in your jibo cli robot-list)
   ```
  2. The Dev Shell is now running (it's a part of the SSM now), so now run a skill by running the following from that skill's root folder: `jibo run`

**To Debug the SSM, run the following:**

```bash
./bin/debug-skills-service-manager-on-robot.sh
```

### Packing for buildroot
 1. Go into the SSM folder root
        cd packages/skills-service-manager
 2. Use the following script/command to automatically tar and upload a skills-service-manager package to the repository that buildroot has access to. Example call: `yarn buildroot francois_laberge`:
        yarn buildroot  <repository.jibo.com's version of LDAP user name>
 3. There should now be file called `jibo-ssm-sha` that has contents like the following:
        79d4337345f1214e5fd32d44ee7f1b168667924f32a0180dc6e09465c396c2bb  jibo-ssm-7.0.4.tar.gz
 4. If you haven't already clone the buildroot repo
        git clone ssh://git@git.jibo.com:7999/plat/buildroot.jibo.git
        cd buildroot-jibo
 5. Now make sure you are on the latest branch (unless it's a special occasion it should be the latest platform develop branch (ex. `develop/sprint-2017-05.12`).
        git checkout <target branch> # ex. develop/sprint-2017-05.12
 6. Update your package's details (in `package/jibo-ssm`)
   1. Update the `jibo-ssm.hash` file to use the new shasum you created earlier (See `packages/skills-service-manager/tmp/jibo-ssm-sha`)
   1. Update the `jibo-ssm.mk` file to specify the new version (used in the tar name)
 7. Now create a commit following the appropriate format: **See Blair**
 8. Sometime later: Notify Blair of your changes (in specific JIRA ticket for upcoming build)

#### Gotchas
If you are adding a new directory to skills-service-manager that needs to be on the robot, make sure to add the specific directory to the buildroot makefile for jibo-ssm and follow directions to package up this change for the next build (see avida if you need assistance): `https://git.jibo.com/projects/PLAT/repos/buildroot.jibo/browse/package/jibo-ssm/jibo-ssm.mk`
