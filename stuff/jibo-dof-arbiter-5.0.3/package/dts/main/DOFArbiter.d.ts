/**
 * @author jg
 */
import DOFOptions from "./DOFOptions";
import { Animate } from 'animation-utilities';
export declare type AnimationBuilder = Animate.AnimationBuilder;
export declare type LookatBuilder = Animate.LookatBuilder;
export declare type AnimationInstance = Animate.AnimationInstance;
export declare type LookatInstance = Animate.LookatInstance;
import { OwnerIdentifier } from "./OwnerInfo";
import { PriorityConfig } from "./DOFArbiterPriorityPolicy";
import DOFOwnershipListener from "./DOFOwnershipListener";
/**
 * INTERNAL ONLY CLASS
 *
 * The DOFArbiter tracks use of the robot's dofs, and can arbitrate amongst conflicting users.  Each "requester"
 * can have a priority, and its requests can be denied or cancelled by DOF use of higher priority requesters.  Using the
 * animation-utilities functions directly auto-assigns a label of "Direct".  "Direct" requests will never be denied,
 * so the priority assigned to "Direct" will only affect whether other users will be allowed to interrupt its motions,
 * which differs from other elements of the priority config which control both motion initiation and interruption.
 * Because of this, giving "Direct" anything other than the highest priority may create confusing behavior.
 *
 * To be fully deniable/interruptible via the arbitration provided here, use playAnimation and startLookat provided
 * here rather than the animation-utilities alternatives.
 *
 * The DOFArbiter installs a global listener into animation-utilities to catch the start
 * of every animation and lookat.  When an animation/lookat starts through animation utilities, we mark
 * its dofs as assigned to its instance (or to no instance, as transient, for instance-less single-frame uses).
 * Initially every instance is marked as requested by Direct.
 *
 * If the motion command was initialized here through planAnimation/startLookat, the dofs will be re-assigned from
 * "Direct" to the provided requester before the end of the function.
 *
 * @example
 *
 *   DOFArbiter.playAnimation(builder, owner, options)
 *       if(dofs are available to this requester)
 *           update builderToOwner map
 *           instance = builder.play()
 *               fires global "ADDED" event (this happens within the stack of builder.play())
 *                   choose owner from builderToOwnerMap, or "Direct" if not present
 *                   "markInUseByInstance()" assigns dofs to instance and owner
 *           //Not anymore, now assigned correctly in markInUseByInstance.  //"updateOwnerByInstance()" Re-assigns dofs associated with "instance" to "owner"
 *           //dofs now owned by "owner", will auto-release with the end of "instance"
 *       return
 *
 * @namespace jibo.dofarbiter
 * @intdocs
 */
declare class DOFArbiter {
    private animationUtilities;
    private dofOwners;
    private policy;
    private debug;
    /**
     * The dofs initially owned by the instance.
     * These dofs will become stale after returning control after ADDED event; after that time
     * they should be interpreted as the superset of dofs currently in use by the instance.
     *
     * When the instance exits (stopped, cancelled) it will be deleted from the map.
     */
    private instanceToDOF;
    /**
     * Hold the relationship between builders and owners; builders are placed here temporarily
     * right before they are started by the playAnimation/startLookat functions, so that the
     * globalEventHandler will be able to look up and assign the correct owner based on the
     * instance's builder.  Builder will be removed from this map before end of playAnimation/
     * startLookat.
     */
    private builderToOwner;
    /**
     * This owner is assigned to motions that go through animation utilities directly, bypassing this API
     * @type {string}
     */
    private directRequester;
    /**
     * The main animation layer; we only track ownership over this layer.
     * @type {string}
     */
    private mainAnimationLayer;
    /**
     * The period of time to keep ownership with previous owner after instance expires; the goal is to allow
     * an owner a small buffer to respond to the instance ending and trigger a followup motion without
     * ownership changing.
     *
     * @type {number}
     */
    private graceExpiryPeriodS;
    /**
     * Listeners for dof lost/gained events for the different owners
     */
    private ownershipListeners;
    private ownershipListenersInOrder;
    private eventDispatcher;
    private defaultOptions;
    private defaultBuilder;
    constructor();
    /**
     * @method jibo.dofarbiter#init
     * @param {AnimationUtilities} animationUtilities
     * @param {?PriorityConfig} [priorityConfig] optional configuration for the priorities of requesters
     */
    init(animationUtilities: any, priorityConfig?: PriorityConfig): void;
    /**
     * Update state, should be called periodically
     * @method jibo.dofarbiter#update
     */
    update(): void;
    /**
     * Try to play this animation; animation may play, play partially, or not play based on current
     * ownership of dofs and policy.
     * @method jibo.dofarbiter#playAnimation
     * @param {AnimationBuilder} builder - the builder to play
     * @param {jibo.dofarbiter.OwnerIdentifier} requester - the identifier of the requesting party (used by arbitration policy)
     * @param {jibo.dofarbiter.DOFOptions} [options] - options that can be taken into account during arbitration
     * @returns {AnimationInstance} instance if intending to play or partially play, null if not intending to play
     */
    playAnimation(builder: AnimationBuilder, requester: OwnerIdentifier, options?: DOFOptions): AnimationInstance | null;
    /**
     * @method jibo.dofarbiter#startLookat
     * @param {LookatBuilder} builder - the builder to play
     * @param {jibo.dofarbiter.OwnerIdentifier} requester - the identifier of the requesting party (used by arbitration policy)
     * @param {THREE.Vector3} target - lookat target
     * @param {jibo.dofarbiter.DOFOptions} [options] - options that can be taken into account during arbitration
     * @returns {LookatInstance} instance if intending to play or partially play, null if not intending to play
     */
    startLookat(builder: LookatBuilder, requester: OwnerIdentifier, target: any, options?: DOFOptions): LookatInstance | null;
    /**
     * Restore the robot to its default pose, respecting current base orientation.
     * Centering may occur fully, partially, or not at all based on current ownership of dofs and policy.
     *
     * Optional arguments allow specification of which DOFs to include in the centering behavior and
     * whether the centering behavior should restore the robot to its global "home" orientation. By default, the
     * centering behavior will include all DOFs and will preserve the robot's current local orientation.
     * @method jibo.dofarbiter#centerRobot
     * @param {jibo.dofarbiter.OwnerIdentifier} requester - The identifier of the requesting party (used by arbitration policy).
     * @param {jibo.animate.DOFSet} [whichDOFs] - Set of DOFs to restore to default position. Defaults to all DOFs.
     * @param {boolean} [centerGlobally=false] - If `true`, also restores the robot to its global "home" orientation.
     * @param {Function} [completionCallback] - Called when centering behavior completes or is interrupted.
     */
    centerRobot(requester: OwnerIdentifier, whichDOFs?: any, centerGlobally?: boolean, completionCallback?: Function): void;
    /**
     * Restore the robot to its default pose, respecting current base orientation.
     * Centering may occur fully, partially, or not at all based on current ownership of dofs and policy.
     *
     * "requestor" priority will be used to seize the DOFs for this operation, but the operation will otherwise
     * be performed at "trustee" priority.
     *
     * Optional arguments allow specification of which DOFs to include in the centering behavior,
     * whether the centering behavior should restore the robot to its global "home" orientation, and allow filtering
     * set of DOFs based on most recent owner. By default, the centering behavior will include all DOFs and will
     * preserve the robot's current local orientation.
     *
     * @method jibo.dofarbiter#centerWithHybridPriority
     * @param {jibo.dofarbiter.OwnerIdentifier} requester - The identifier of the requesting party, only DOFs available to this party will be considered for centering.
     * @param {jibo.dofarbiter.OwnerIdentifier} trustee - This will be the identifier used for the ongoing centering operation (relevant for those that try to interrupt).
     * @param {jibo.animate.DOFSet} [desiredDOFSet] - Set of DOFs to consider. Defaults to all DOFs.
     * @param {jibo.dofarbiter.OwnerIdentifier[]} onlyForOwners - If provided, will only center the subset of desiredDOFs currently or most recently owned by these owners.
     * @param {boolean} [centerGlobally=false] - If `true`, also restores the robot to its global "home" orientation.
     * @param {Function} [completionCallback] - Called when centering behavior completes or is interrupted.
     */
    centerWithHybridPriority(requester: OwnerIdentifier, trustee: OwnerIdentifier, desiredDOFSet: any, onlyForOwners: OwnerIdentifier[], centerGlobally: boolean, completionCallback: Function): void;
    /**
     * Attempt to claim the provided dofs under responsibility of the provided instance.
     * Instance should not be null, as the dofs will be waiting to be released by STOPPED/CANCELLED
     * from that instance.  This will only claim dofs that are available according to the policy;
     * the set of dofs actually claimed will be returned.
     *
     * NOTE: Even if zero dofs are returned, we still expect a STOPPED/CANCELLED event for this instance, so caller
     * should still .play or .start etc.
     * @method jibo.dofarbiter#attemptToClaimForInstance
     * @param {jibo.dofarbiter.OwnerIdentifier} requester
     * @param {any} instance
     * @param {string[]} desiredDOFs
     * @param {jibo.dofarbiter.DOFOptions} [options]
     * @returns {string[]}
     */
    attemptToClaimForInstance(requester: OwnerIdentifier, instance: any, desiredDOFs: string[], options?: DOFOptions): string[];
    /**
     *
     * @method jibo.dofarbiter#getAvailable
     * @param {jibo.dofarbiter.OwnerIdentifier} requester
     * @param {any} instance
     * @param {string[]} desiredDOFs
     * @param {jibo.dofarbiter.DOFOptions} [options]
     * @returns {string[]}
     */
    getAvailable(requester: OwnerIdentifier, desiredDOFs: string[], options?: DOFOptions): string[];
    /**
     *
     * @method jibo.dofarbiter#getDofsInUse
     * @param requester {jibo.dofarbiter.OwnerIdentifier}
     * @returns {string[]}
     */
    getDofsInUse(requester: OwnerIdentifier): string[];
    /**
     *
     * @method jibo.dofarbiter#addListener
     * @param forEventsForOwner {jibo.dofarbiter.OwnerIdentifier}
     * @param listener {jibo.dofarbiter.DOFOwnershipListener}
     * @returns {string[]}
     */
    addListener(forEventsForOwner: OwnerIdentifier, listener: DOFOwnershipListener): void;
    /**
     *
     * @method jibo.dofarbiter#removeListener
     * @param forEventsForOwner {jibo.dofarbiter.OwnerIdentifier}
     * @param listener {jibo.dofarbiter.DOFOwnershipListener}
     * @returns {string[]}
     */
    removeListener(forEventsForOwner: OwnerIdentifier, listener: DOFOwnershipListener): void;
}
export default DOFArbiter;
