export type HighspotContentAction =
    | GetCurrentUserAction
    | CreateItemAction
    | GetItemAction
    | DeleteItemAction
    | CreateSpotAction
    | GetSpotItemsAction
    | DeleteSpotAction
    | GetAllSpotsAction
    | GetAllItemsAction

export interface GetCurrentUserAction {
    actionName: "getCurrentUser"
}

export interface CreateItemAction {
    actionName: "createItem",
    parameters?: {
        id: string
        spot_id: string
        name: string
        location: string
    }
}

export interface GetItemAction {
    actionName: "getItem"
    parameters?: {
        item_id?: string
        title: string
    }
}

export interface DeleteItemAction {
    actionName: "deleteItem",
    parameters?: {
        item_id: string
    }
}

export interface CreateSpotAction {
    actionName: "createSpot"
    parameters?: {
        title: string
    }
}

export interface GetSpotItemsAction {
    actionName: "getSpotItems",
    parameters?: {
        spot_name : string
        spot_id?: string
    }
}

export interface DeleteSpotAction {
    actionName: "deleteSpot"
    parameters?: {
        spot_id?: string
        title: string
    }
}

export interface GetAllSpotsAction {
    actionName: "getAllSpots"
}

export interface GetAllItemsAction {
    actionName: "getAllItems"
}