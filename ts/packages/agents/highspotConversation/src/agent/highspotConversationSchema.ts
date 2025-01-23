export type HighspotConversationAction =
    | QueryAction

export interface QueryAction {
    actionName: "query"
    parameters?: {
        query: string
    }
}
