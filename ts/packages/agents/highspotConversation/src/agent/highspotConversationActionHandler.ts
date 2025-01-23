import {
    AppAction,
    AppAgent,
    ActionResult,
} from "@typeagent/agent-sdk";
import {
    createActionResultFromTextDisplay,
} from "@typeagent/agent-sdk/helpers/action";

import { HighspotConversationAction } from "./highspotConversationSchema.js";

export function instantiate(): AppAgent {
    return {
        executeAction: executeHighspotConversationAction,
    };
}

async function executeHighspotConversationAction(
    action: AppAction,
): Promise<ActionResult> {
    const result = await handleHighspotConversationAction(
        action as HighspotConversationAction
    );
    return result;
}

async function handleQueryAction(action: HighspotConversationAction) {
    return createActionResultFromTextDisplay(
        "query",
        action.parameters?.query || "",
    );
}

async function handleHighspotConversationAction(
    action : HighspotConversationAction,
) {
    switch (action.actionName) {
        case "query":
            return await handleQueryAction(action);
        default:
            throw new Error(`Unsupported action: ${action.actionName}`);
    }
}
