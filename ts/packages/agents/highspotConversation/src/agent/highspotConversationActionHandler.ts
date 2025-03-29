import {
    AppAction,
    AppAgent,
    ActionResult,
    ActionContext,
    SessionContext,
} from "@typeagent/agent-sdk";
import {
    createActionResultFromTextDisplay,
} from "@typeagent/agent-sdk/helpers/action";

import { HighspotConversationAction, LoadCSVAction, QueryContentAction, QueryPeopleAction } from "./highspotConversationSchema.js";
import { createSqliteDb, ISqliteDB } from "../sqliteHandler.js";
import { parseAndExecuteQuery } from "../queryHandler.js";

export type HighspotActionContext = {
    db: ISqliteDB | undefined;
};

async function initizalizeHighspotConversationContext() {
    return {
        db: await createSqliteDb(),
    };
}

export function instantiate(): AppAgent {
    return {
        executeAction: executeHighspotConversationAction,
        initializeAgentContext: initizalizeHighspotConversationContext,
    };
}

async function executeHighspotConversationAction(
    action: AppAction,
    context: ActionContext<HighspotActionContext>,
): Promise<ActionResult> {
    const result = await handleHighspotConversationAction(
        action as HighspotConversationAction,
        context.sessionContext
    );
    return result;
}

async function handleQueryPeopleAction(action: QueryPeopleAction, context: SessionContext<HighspotActionContext>) {

    console.log(`Querying people with query: ${action.parameters?.query}`);

    if (!action.parameters) {
        return createActionResultFromTextDisplay(
            "ERROR: No query provided",
            undefined,
        );
    }

    // TODO these are bad hardcoded but just for poc
    const tableName = "user";

    const result = await parseAndExecuteQuery(action.parameters.query, tableName, context);

    return createActionResultFromTextDisplay(
        result,
        action.parameters?.query || "",
    );
}

async function handleQueryContentAction(action: QueryContentAction, context: SessionContext<HighspotActionContext>) {

    console.log(`Querying items with query: ${action.parameters?.query}`);

    if (!action.parameters) {
        return createActionResultFromTextDisplay(
            "ERROR: No query provided",
            undefined,
        );
    }

    // TODO these are bad hardcoded but just for poc
    const tableName = "content";

    const result = await parseAndExecuteQuery(action.parameters.query, tableName, context);

    return createActionResultFromTextDisplay(
        result,
        action.parameters?.query || "",
    );
}

async function handleLoadCSVAction(action: LoadCSVAction, context: SessionContext<HighspotActionContext>) {
    if (!context.agentContext.db) {
        return createActionResultFromTextDisplay(
            "ERROR: Database not initialized",
            action.parameters.filename,
        )
    }

    const result = await context.agentContext.db.loadCSV(action.parameters.filename) || "ERROR";
    return createActionResultFromTextDisplay(
        result,
        action.parameters.filename,
    );
}

async function handleHighspotConversationAction(
    action : HighspotConversationAction,
    context: SessionContext<HighspotActionContext>,
) {
    switch (action.actionName) {
        case "queryPeople":
            return await handleQueryPeopleAction(action, context);
        case "queryContent":
            return await handleQueryContentAction(action, context);
        case "loadCSV":
            return await handleLoadCSVAction(action, context);
        default:
            throw new Error(`Unsupported action: ${action}`);
    }
}