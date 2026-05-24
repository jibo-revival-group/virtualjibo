import Model from './Model';
import RobotModelEvents from './RobotModelEvents';
export declare type ErrCallback = (err) => void;
/**
 * Jibo KB Robot Properties API
 * @namespace jibo.kb.robot
 */
/** RobotModel Class. The Robot Model subclass
 *
 * @class RobotModel
 * @extends jibo.kb.Model
 * @memberof jibo.kb.robot
 * @example
 * let model = jibo.kb.robot.createModel('/jibo/robot');
 */
export default class RobotModel extends Model {
    /**
     * Strongly-typed events emitted by this model
     * @intdocs
     * @name jibo.kb.robot.events
     * @type {jibo.kb.robot.RobotModelEvents}
     */
    events: RobotModelEvents;
    private _wsClient;
    constructor(kbNames: string | string[], httpUrl?: string);
    private _listenForWSMessages();
    private _wsMessageReceived(message);
}
