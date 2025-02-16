export type HighspotConversationAction =
    | QueryPeopleAction
    | QueryContentAction
    | LoadCSVAction

export interface QueryAction {
    actionName: "query"
    parameters?: {
        query: string
    }
}

export interface LoadCSVAction {
    actionName: "loadCSV"
    parameters: {
        filename: string
    }
}

// for any questions about people
export interface QueryPeopleAction {
    actionName: "queryPeople"
    parameters?: {
        // part of the request specifying the specific search
        // terms that describe the peerson data the user
        // is searching for
        query: string
    }
}

// for any questions about content or documents
export interface QueryContentAction {
    actionName: "queryContent"
    parameters?: {
        // part of the request specifying the specific search
        // terms that describe the peerson data the user
        // is searching for
        query: string
    }
}
