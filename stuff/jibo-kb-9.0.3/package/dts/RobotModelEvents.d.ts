import { Event, EventContainer } from 'jibo-typed-events';
/**
 * Strongly-typed events emitted by RobotModel
 * @intdocs
 * @class jibo.kb.robot.RobotModelEvents
 */
export default class RobotModelEvents extends EventContainer {
    /**
     * Event emitted whenever the robot properties have been updated
     * (including on mobile devices)
     * @name jibo.kb.robot.RobotModelEvents#robotUpdated
     * @type {Event}
     */
    robotUpdated: Event<void>;
}
