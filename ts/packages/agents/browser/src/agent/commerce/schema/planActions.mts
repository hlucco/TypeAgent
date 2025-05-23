// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// IMPORTANT: Use this action when the user query involves search for products on an e-commerce store, such as "aaa batteries"
export type SearchForProduct = {
    actionName: "searchForProduct";
    parameters: {
        productName: string;
    };
};

export type GoToProductPage = {
    actionName: "goToProductPage";
    parameters: {
        position?: number;
        productName?: string;
    };
};

export type AddToCart = {
    actionName: "addToCart";
    parameters: {
        productName: string;
    };
};

// This allows you to view the shopping cart contents
export type ViewShoppingCart = {
    actionName: "viewShoppingCart";
};

export type FindNearbyStore = {
    actionName: "findNearbyStore";
};

// Use this action for user queries such as "where is product X in the store"
// This action is available when on the Product Details Page
export type GetLocationInStore = {
    actionName: "getLocationInStore";
    parameters: {
        productName: string;
    };
};

// Ask the user a yes/no question to clarify shopping operations
export type ClarifyBuyAction = {
    actionName: "clarifyBuyAction";
    parameters: {
        question: string;
    };
};

// IMPORTANT: Mark the plan as completed only after you are sure that the user objective has been FULLY met.
export type PlanCompleted = {
    actionName: "planCompleted";
};

export type ShoppingPlanActions =
    | AddToCart
    | ViewShoppingCart
    | SearchForProduct
    | GoToProductPage
    | GetLocationInStore
    | FindNearbyStore
    | ClarifyBuyAction
    | PlanCompleted;
