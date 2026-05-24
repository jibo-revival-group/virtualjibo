import Node from './Node';
export declare type LocationOverride = {
    city: string;
    state: string;
    stateAbbr: string;
    country: string;
    lat: number;
    lng: number;
};
/**
 * @class RobotRootNode
 * @extends jibo.kb.Node
 * @memberof jibo.kb.robot
 */
export default class RobotRootNode extends Node {
    data: {
        id: string;
        updated: number;
        created: number;
        avatar?: number;
        serialNumber?: string;
        platform?: string;
        connectedAt?: number;
        SSID?: string;
        locationOverride?: LocationOverride;
    };
    /**
     * Get location override info if it has been set by the app.
     * @name jibo.kb.robot.RobotRootNode#locationOverride
     * @type {String}
     */
    readonly locationOverride: LocationOverride;
}
