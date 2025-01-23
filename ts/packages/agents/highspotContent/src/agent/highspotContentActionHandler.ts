// Copyright (c) Highspot Inc.

import {
    AppAction,
    AppAgent,
    ActionResult,
    ActionContext,
    SessionContext,
    AppAgentEvent,
} from "@typeagent/agent-sdk";
import {
    createActionResultFromTextDisplay,
} from "@typeagent/agent-sdk/helpers/action";

import { HighspotContentAction } from "./highspotContentSchema.js";
import { createSpot, deleteSpot, getAllSpots, getCurrentUser, getItem, getSpotItems } from "../endpoints.js";
import { HighspotService } from "../service.js";
import chalk from "chalk";
import { HighspotItem } from "../highspotApiSchema.js";

export function instantiate(): AppAgent {
    return {
        initializeAgentContext: initializeHighspotContentContext,
        updateAgentContext: updateHighspotContentContext,
        executeAction: executeHighspotContentAction,
    };
}

export interface IClientContext {
    service: HighspotService | undefined;
}

export type HighspotActionContext = {
    highspot: HighspotService | undefined;
};

async function initializeHighspotContentContext() {
    return {
        highspot: undefined,
    };
}

async function executeHighspotContentAction(
    action: AppAction,
    context: ActionContext<HighspotActionContext>
) {
    if (context.sessionContext.agentContext.highspot) {
        let result = await handleHighspotContentAction(
            action as HighspotContentAction,
            context.sessionContext.agentContext
        );

        return result;
    }
}

async function enableHighspot(context: SessionContext<HighspotActionContext>) {
    const clientContext = new HighspotService();
    context.agentContext.highspot = clientContext;
    return clientContext.getAccessToken();
}

async function updateHighspotContentContext(
    enable: boolean,
    context: SessionContext<HighspotActionContext>,
) {
    if (enable) {
        const accessToken = await enableHighspot(context);
        context.notify(
            AppAgentEvent.Info,
            chalk.blue(`Highspot integration enabled. Using token: ${accessToken}.`),
        );
    } else {
        chalk.red("Highspot integration disabled.");
        context.agentContext.highspot = undefined;
    }
}

async function handleHighspotContentAction(
    action: HighspotContentAction,
    context: HighspotActionContext
) {
    let result: ActionResult | undefined = undefined;
    let displayText: string | undefined = undefined;

    console.log(`Triggered: ${action.actionName}`);
    if (!context.highspot) {
        throw new Error("Highspot Service: no highspot");
    }

    switch(action.actionName) {
        case "getCurrentUser": {
            const response = await getCurrentUser(
                context.highspot
            );
            displayText = "No Highspot user found.";
            if (response !== undefined) {
                displayText = `You are logged in as ${response.name} ${response.surname}`;
            }
            result = createActionResultFromTextDisplay(
                displayText
            );
            break;
        }
        case "createItem": {
            break;
        }
        case "getItem": {
            if (!action.parameters) {
                throw new Error("Highspot Service: no parameters");
            }
            let item_id = action.parameters.item_id;
            if (item_id === undefined) {
                const spotsResponse = await getAllSpots(
                    context.highspot
                );

                if (spotsResponse === undefined) {
                    throw new Error("Highspot Service: no spots found");
                }

                const spotIds = spotsResponse.collection.map(spot => spot.id);
                let highspotItems: HighspotItem[] = [];
                await Promise.all(
                    spotIds.map(async spotId => {
                        if (context.highspot === undefined) {
                            throw new Error("Highspot Service: no highspot");
                        }

                        const response = await getSpotItems(
                            context.highspot,
                            spotId
                        );

                        if (response !== undefined) {
                            highspotItems = highspotItems.concat(response.collection);
                        }

                    })
                );


                highspotItems.forEach(item => {
                    if (action.parameters === undefined) {
                        throw new Error("Highspot Service: no parameters");
                    }

                    if (item.title === action.parameters.title) {
                        item_id = item.id;
                    }
                });
            }

            if (item_id === undefined) {
                displayText = `No item found with title ${action.parameters.title}`;
                result = createActionResultFromTextDisplay(
                    displayText
                );
                break;
            }

            const response = await getItem(
                context.highspot,
                item_id
            );
            displayText = "No Highspot item found.";
            if (response !== undefined) {
                displayText = `Item found: ${response.title} ${response.author} ${response.date_added} ${response.id}`;
            }
            result = createActionResultFromTextDisplay(
                displayText
            );
            break;
        }
        case "deleteItem": {
            if (!action.parameters) {
                throw new Error("Highspot Service: no parameters");
            }
            /*
            const item_id = action.parameters.item_id;
            const response = await deleteItem(
                context.highspot,
                item_id
            );*/
            displayText = "Highspot API does not support item deletion.";
            result = createActionResultFromTextDisplay(
                displayText
            );
            break;
        }
        case "createSpot": {
            if (!action.parameters) {
                throw new Error("Highspot Service: no parameters");
            }

            const response = await createSpot(
                context.highspot,
                action.parameters.title
            );

            displayText = "No Highspot spot created.";
            if (response !== undefined) {
                displayText = `Spot created: ${action.parameters.title}, ${response.id}`;
            }

            result = createActionResultFromTextDisplay(
                displayText
            );
            break;
        }
        case "getSpotItems": {
            if (!action.parameters) {
                throw new Error("Highspot Service: no parameters");
            }
            let spot_id = action.parameters.spot_id;
            if (spot_id === undefined) {
                const spots = await getAllSpots(context.highspot);

                if (spots === undefined) {
                    throw new Error("Highspot Service: no spots found");
                }

                spots.collection.forEach(spot => {
                    if (!action.parameters) {
                        throw new Error("Highspot Service: no parameters");
                    }

                    if (spot.title === action.parameters.spot_name) {
                        spot_id = spot.id;
                    }
                });

            }

            if (spot_id === undefined) {
                displayText = `No spot found with name ${action.parameters.spot_name}`;
                result = createActionResultFromTextDisplay(
                    displayText
                );
                break;
            }

            const response = await getSpotItems(
                context.highspot,
                spot_id,
            );
            displayText = "No Highspot items found in this spot.";
            if (response !== undefined) {
                const itemTitles = response.collection.map(item => `- ${item.title}, ${item.author}, ${item.date_added}`).join("\n");
                displayText = `Items found in spot ${action.parameters.spot_name}: \n${itemTitles}`;
            }
            result = createActionResultFromTextDisplay(
                displayText
            );
            break;
        }
        case "deleteSpot": {
            if (!action.parameters) {
                throw new Error("Highspot Service: no parameters");
            }

            let spot_id = action.parameters.spot_id;
            if (spot_id === undefined) {
                const spots = await getAllSpots(context.highspot);

                if (spots === undefined) {
                    throw new Error("Highspot Service: no spots found");
                }

                spots.collection.forEach(spot => {
                    if (!action.parameters) {
                        throw new Error("Highspot Service: no parameters");
                    }

                    if (spot.title === action.parameters.title) {
                        spot_id = spot.id;
                    }
                });

            }

            if (spot_id === undefined) {
                displayText = `No spot found with name ${action.parameters.title}`;
                result = createActionResultFromTextDisplay(
                    displayText
                );
                break;
            }

            const response = await deleteSpot(
                context.highspot,
                spot_id
            );
            displayText = "No Highspot spot found.";
            if (response !== undefined) {
                displayText = `Spot deleted: ${action.parameters.title}`;
            }
            result = createActionResultFromTextDisplay(
                displayText
            );
            break;
        }
        case "getAllSpots": {
            const response = await getAllSpots(
                context.highspot
            );
            displayText = "No Highspot spots found.";
            if (response !== undefined) {
                const titles = response.collection.map(spot => `- ${spot.title} ${spot.id}`).join("\n");
                displayText = `Spots found:\n${titles}`;
            }
            result = createActionResultFromTextDisplay(
                displayText
            );
            break;
        }
        case "getAllItems": {
            const spotsResponse = await getAllSpots(
                context.highspot
            );

            if (spotsResponse === undefined) {
                throw new Error("Highspot Service: no spots found");
            }

            const spotIds = spotsResponse.collection.map(spot => spot.id);
            let highspotItems: HighspotItem[] = [];
            await Promise.all(
                spotIds.map(async spotId => {
                    if (context.highspot === undefined) {
                        throw new Error("Highspot Service: no highspot");
                    }

                    const response = await getSpotItems(
                        context.highspot,
                        spotId
                    );

                    if (response !== undefined) {
                        highspotItems = highspotItems.concat(response.collection);
                    }

                })
            );

            displayText = "No Highspot items found.";
            if (highspotItems.length > 0) {
                const titles = highspotItems.map(item => `- ${item.title}, ${item.author}, ${item.date_added}`).join("\n");
                displayText = `Items found:\n${titles}`;
            }
            result = createActionResultFromTextDisplay(
                displayText
            );
            break;
        }
    }

    return result
}
