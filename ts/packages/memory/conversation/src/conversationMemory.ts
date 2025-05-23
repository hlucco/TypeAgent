// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { conversation as kpLib } from "knowledge-processor";
import * as kp from "knowpro";
import { queue, QueueObject } from "async";
import { parseTranscript } from "./transcript.js";
import registerDebug from "debug";
import { error, Result, success } from "typechat";
import { createMemorySettings, Memory, MemorySettings } from "./memory.js";
const debugLogger = registerDebug("conversation-memory.podcast");

export class ConversationMessageMeta
    implements kp.IKnowledgeSource, kp.IMessageMetadata
{
    constructor(
        public sender?: string | undefined,
        public recipients?: string[] | undefined,
    ) {}

    public get source() {
        return this.sender;
    }
    public get dest() {
        return this.recipients;
    }

    getKnowledge(): kpLib.KnowledgeResponse | undefined {
        if (this.sender) {
            const entities: kpLib.ConcreteEntity[] = [];
            const actions: kpLib.Action[] = [];
            const inverseActions: kpLib.Action[] = [];
            if (this.sender) {
                entities.push({
                    name: this.sender,
                    type: ["person"],
                });
            }
            if (this.recipients && this.recipients.length > 0) {
                for (const recipient of this.recipients) {
                    entities.push({
                        name: recipient,
                        type: ["person"],
                    });
                }
                for (const recipient of this.recipients) {
                    const action: kpLib.Action = {
                        verbs: ["send"],
                        verbTense: "past",
                        subjectEntityName: this.sender,
                        objectEntityName: recipient,
                        indirectObjectEntityName: "none",
                    };
                    actions.push(action);
                    const inverseAction: kpLib.Action = {
                        verbs: ["receive"],
                        verbTense: "past",
                        subjectEntityName: recipient,
                        objectEntityName: this.sender,
                        indirectObjectEntityName: "none",
                    };
                    inverseActions.push(inverseAction);
                }
            }
            return {
                entities,
                actions,
                inverseActions,
                topics: [],
            };
        }
        return undefined;
    }
}

export class ConversationMessage implements kp.IMessage {
    public textChunks: string[];
    public timestamp: string;
    public deletionInfo?: kp.DeletionInfo | undefined;

    constructor(
        messageText: string | string[],
        public metadata: ConversationMessageMeta,
        public tags: string[] = [],
        /**
         * Any pre-extracted knowledge for this message.
         */
        public knowledge?: kpLib.KnowledgeResponse,
        timestamp?: string,
    ) {
        this.textChunks = Array.isArray(messageText)
            ? messageText
            : [messageText];
        this.timestamp = timestamp ?? new Date().toISOString();
    }

    public addContent(content: string, chunkOrdinal = 0) {
        if (chunkOrdinal > this.textChunks.length) {
            this.textChunks.push(content);
        } else {
            this.textChunks[chunkOrdinal] += content;
        }
    }

    public addKnowledge(
        newKnowledge: kpLib.KnowledgeResponse,
    ): kpLib.KnowledgeResponse {
        if (this.knowledge !== undefined) {
            this.knowledge.entities = kp.mergeConcreteEntities([
                ...this.knowledge.entities,
                ...newKnowledge.entities,
            ]);
            this.knowledge.topics = kp.mergeTopics([
                ...this.knowledge.topics,
                ...newKnowledge.topics,
            ]);
            this.knowledge.actions.push(...newKnowledge.actions);
            this.knowledge.inverseActions.push(...newKnowledge.inverseActions);
        } else {
            this.knowledge = newKnowledge;
        }
        return this.knowledge;
    }

    public getKnowledge(): kpLib.KnowledgeResponse | undefined {
        let metaKnowledge = this.metadata.getKnowledge();
        if (!metaKnowledge) {
            return this.knowledge;
        }
        if (!this.knowledge) {
            return metaKnowledge;
        }
        const combinedKnowledge: kpLib.KnowledgeResponse = {
            ...this.knowledge,
        };
        combinedKnowledge.entities.push(...metaKnowledge.entities);
        combinedKnowledge.actions.push(...metaKnowledge.actions);
        combinedKnowledge.inverseActions.push(...metaKnowledge.inverseActions);
        combinedKnowledge.topics.push(...metaKnowledge.topics);
        return combinedKnowledge;
    }
}

export type ConversationMemorySettings = MemorySettings;

export class ConversationMemory
    extends Memory
    implements kp.IConversation<ConversationMessage>
{
    public messages: kp.MessageCollection<ConversationMessage>;
    public settings: ConversationMemorySettings;
    public semanticRefIndex: kp.ConversationIndex;
    public secondaryIndexes: kp.ConversationSecondaryIndexes;
    public semanticRefs: kp.SemanticRefCollection;

    private updatesTaskQueue: QueueObject<ConversationMemoryTasks>;

    constructor(
        public nameTag: string = "",
        messages: ConversationMessage[] = [],
        public tags: string[] = [],
        settings?: ConversationMemorySettings,
    ) {
        super();
        this.messages = new kp.MessageCollection<ConversationMessage>(messages);
        this.semanticRefs = new kp.SemanticRefCollection();
        if (!settings) {
            settings = this.createSettings();
        }
        this.settings = settings;
        this.adjustSettings();

        this.semanticRefIndex = new kp.ConversationIndex();
        this.secondaryIndexes = new kp.ConversationSecondaryIndexes(
            this.settings.conversationSettings,
        );
        this.updatesTaskQueue = this.createTaskQueue();
    }

    public async addMessage(
        message: ConversationMessage,
    ): Promise<Result<kpLib.KnowledgeResponse>> {
        //
        // Messages can contain prior knowledge extracted during chat responses for example
        // To avoid knowledge duplication, we:
        // - (a) Manually extract knowledge from the message
        // - (b) merge it with any prior knowledge
        // - (c) Surface the combined knowledge from the IMessage.getKnowledge implementation
        // - (d) configure the indexing engine not to automatically extract any other knowledge
        //
        const knowledgeResult = await kp.extractKnowledgeFromText(
            this.settings.conversationSettings.semanticRefIndexSettings
                .knowledgeExtractor!,
            message.textChunks[0].trim(),
            3,
        );
        if (!knowledgeResult.success) {
            return knowledgeResult;
        }
        // This will merge the new knowledge with the prior knowledge
        let messageKnowledge = knowledgeResult.data;
        messageKnowledge = message.addKnowledge(messageKnowledge);

        // Now, add the message to memory and index it
        let messageOrdinalStartAt = this.messages.length;
        let semanticRefOrdinalStartAt = this.semanticRefs.length;
        this.messages.append(message);
        kp.addToConversationIndex(
            this,
            this.settings.conversationSettings,
            messageOrdinalStartAt,
            semanticRefOrdinalStartAt,
        );

        const saveResult = await this.autoSaveFile();
        if (!saveResult.success) {
            return saveResult;
        }

        // Clear the knowledge, now that its been indexed
        message.knowledge = undefined;
        return success(messageKnowledge!);
    }

    public queueAddMessage(
        message: ConversationMessage,
        completionCallback: ConversationTaskCallback,
    ): void {
        this.updatesTaskQueue.push({
            type: "addMessage",
            message,
            callback: completionCallback,
        });
    }

    /**
     * Run a natural language query against this memory
     * @param searchText
     * @returns
     */
    public async search(
        searchText: string,
    ): Promise<Result<kp.ConversationSearchResult[]>> {
        return kp.searchConversationWithLanguage(
            this,
            searchText,
            this.getQueryTranslator(),
        );
    }

    public async createSearchQuery(
        searchText: string,
        options?: kp.LanguageSearchOptions,
    ): Promise<Result<kp.SearchQueryExpr[]>> {
        const queryResult = await kp.searchQueryExprFromLanguage(
            this,
            this.getQueryTranslator(),
            searchText,
            options,
        );
        return queryResult;
    }

    public async selectFromConversation(
        selectExpr: kp.SearchSelectExpr,
    ): Promise<kp.ConversationSearchResult | undefined> {
        return kp.searchConversation(
            this,
            selectExpr.searchTermGroup,
            selectExpr.when,
        );
    }

    public async waitForPendingTasks(): Promise<void> {
        await this.updatesTaskQueue.drain();
    }

    public async serialize(): Promise<ConversationMemoryData> {
        const data: ConversationMemoryData = {
            nameTag: this.nameTag,
            messages: this.messages.getAll(),
            tags: this.tags,
            semanticRefs: this.semanticRefs.getAll(),
            semanticIndexData: this.semanticRefIndex?.serialize(),
            relatedTermsIndexData:
                this.secondaryIndexes.termToRelatedTermsIndex.serialize(),
            messageIndexData: this.secondaryIndexes.messageIndex?.serialize(),
        };
        return data;
    }

    public async deserialize(data: ConversationMemoryData): Promise<void> {
        this.nameTag = data.nameTag;
        this.messages = this.deserializeMessages(data);
        this.semanticRefs = new kp.SemanticRefCollection(data.semanticRefs);
        this.tags = data.tags;
        if (data.semanticIndexData) {
            this.semanticRefIndex = new kp.ConversationIndex(
                data.semanticIndexData,
            );
        }
        if (data.relatedTermsIndexData) {
            this.secondaryIndexes.termToRelatedTermsIndex.deserialize(
                data.relatedTermsIndexData,
            );
        }
        if (data.messageIndexData) {
            this.secondaryIndexes.messageIndex = new kp.MessageTextIndex(
                this.settings.conversationSettings.messageTextIndexSettings,
            );
            this.secondaryIndexes.messageIndex.deserialize(
                data.messageIndexData,
            );
        }
        // Rebuild transient secondary indexes associated with the conversation
        await kp.buildTransientSecondaryIndexes(
            this,
            this.settings.conversationSettings,
        );
    }

    public async writeToFile(
        dirPath: string,
        baseFileName: string,
    ): Promise<void> {
        const data = await this.serialize();
        await kp.writeConversationDataToFile(data, dirPath, baseFileName);
    }

    public static async readFromFile(
        dirPath: string,
        baseFileName: string,
    ): Promise<ConversationMemory | undefined> {
        const memory = new ConversationMemory();
        const data = await kp.readConversationDataFromFile(
            dirPath,
            baseFileName,
            memory.settings.conversationSettings.relatedTermIndexSettings
                .embeddingIndexSettings?.embeddingSize,
        );
        if (data) {
            memory.deserialize(data);
        }
        return memory;
    }

    private async autoSaveFile(): Promise<Result<boolean>> {
        try {
            const fileSaveSettings = this.settings.fileSaveSettings;
            if (fileSaveSettings) {
                // TODO: Optionally, back up previous file and do a safe read write
                await this.writeToFile(
                    fileSaveSettings.dirPath,
                    fileSaveSettings.baseFileName,
                );
            }
            return success(true);
        } catch (ex) {
            return error(`AutoSaveFile failed ${ex}`);
        }
    }

    private deserializeMessages(memoryData: ConversationMemoryData) {
        const messages = memoryData.messages.map((m) => {
            const metadata = new ConversationMessageMeta(m.metadata.sender);
            metadata.recipients = m.metadata.recipients;
            return new ConversationMessage(
                m.textChunks,
                metadata,
                m.tags,
                undefined,
                m.timestamp,
            );
        });
        return new kp.MessageCollection<ConversationMessage>(messages);
    }

    private createTaskQueue() {
        return queue(async (task: ConversationMemoryTasks, callback) => {
            try {
                await this.processUpdates(task);
                callback();
            } catch (ex: any) {
                callback(ex);
            }
        }, 1);
    }

    private async processUpdates(task: ConversationMemoryTasks) {
        let callback: ConversationTaskCallback | undefined;
        try {
            switch (task.type) {
                default:
                    break;
                case "addMessage":
                    callback = task.callback;
                    const result = await this.addMessage(task.message);
                    if (callback) {
                        if (result.success) {
                            callback();
                        } else {
                            callback(result.message);
                        }
                    }
                    break;
            }
        } catch (ex) {
            debugLogger(`processUpdates failed: ${ex}`);
            if (callback) {
                callback(ex);
            }
        }
    }

    private adjustSettings(): void {
        this.settings.queryTranslator ??= kp.createSearchQueryTranslator(
            this.settings.languageModel,
        );
        //
        // Messages can contain prior knowledge extracted during chat responses for example
        // To avoid knowledge duplication, we manually extract message knowledge and merge it
        // with any prior knowledge
        //
        this.settings.conversationSettings.semanticRefIndexSettings.autoExtractKnowledge =
            false;
    }

    private createSettings(): ConversationMemorySettings {
        return createMemorySettings(
            () => this.secondaryIndexes.termToRelatedTermsIndex.fuzzyIndex,
        );
    }

    private getQueryTranslator(): kp.SearchQueryTranslator {
        const queryTranslator = this.settings.queryTranslator;
        if (!queryTranslator) {
            throw new Error(`No query translator provided for ${this.nameTag}`);
        }
        return queryTranslator;
    }
}

export type ConversationTaskCallback =
    | ((error?: any | undefined) => void)
    | undefined;

type AddMessageTask = {
    type: "addMessage";
    message: ConversationMessage;
    callback?: ConversationTaskCallback;
};

type ConversationMemoryTasks = AddMessageTask;

export interface ConversationMemoryData
    extends kp.IConversationDataWithIndexes<ConversationMessage> {}

export function parseConversationMemoryTranscript(
    transcriptText: string,
): [ConversationMessage[], Set<string>] {
    const [messages, participants] = parseTranscript(
        transcriptText,
        (sender, messageText) =>
            new ConversationMessage(
                messageText,
                new ConversationMessageMeta(sender),
            ),
    );
    assignMessageRecipients(messages, participants);
    return [messages, participants];
}

function assignMessageRecipients(
    msgs: ConversationMessage[],
    participants: Set<string>,
) {
    for (const msg of msgs) {
        if (msg.metadata.sender) {
            let recipients: string[] = [];
            for (const p of participants) {
                if (p !== msg.metadata.sender) {
                    recipients.push(p);
                }
            }
            msg.metadata.recipients = recipients;
        }
    }
}
