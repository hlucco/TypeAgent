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

import { HighspotQuizAction } from "./highspotQuizSchema.js";
import { HighspotService } from "../service.js";
import chalk from "chalk";
import { HighspotQuiz, generateQuiz } from "../quiz.js";

export function instantiate(): AppAgent {
    return {
        initializeAgentContext: initializeHighspotQuizContext,
        updateAgentContext: updateHighspotQuizContext,
        executeAction: executeHighspotQuizAction,
    };
}

export interface IClientContext {
    service: HighspotService | undefined;
}

export type HighspotActionContext = {
    highspot: HighspotService | undefined;
    quizes: HighspotQuiz[];
};

async function initializeHighspotQuizContext() {
    return {
        highspot: undefined,
    };
}

async function executeHighspotQuizAction(
    action: AppAction,
    context: ActionContext<HighspotActionContext>
) {
    if (context.sessionContext.agentContext.highspot) {
        let result = await handleHighspotContentAction(
            action as HighspotQuizAction,
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

async function updateHighspotQuizContext(
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
    action: HighspotQuizAction,
    context: HighspotActionContext
) {
    let result: ActionResult | undefined = undefined;
    let displayText: string | undefined = undefined;

    console.log(`Triggered: ${action.actionName}`);
    if (!context.highspot) {
        throw new Error("Highspot Service: no highspot");
    }

    switch(action.actionName) {
        case "generateQuiz":
            const numQuestions = action.parameters.num_questions;
            const title = action.parameters.quizTitle;
            const itemName = action.parameters.item;

            const quiz = await generateQuiz(numQuestions, title, itemName, context.highspot);
            context.quizes.push(quiz);

            displayText = `Quiz generated: ${title} with ${numQuestions} questions`;
            result = createActionResultFromTextDisplay(displayText);
            break;
    }

    return result
}
