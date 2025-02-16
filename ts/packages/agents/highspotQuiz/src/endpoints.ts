
// Copyright (c) Highspot Inc.

import axios from "axios";
import { translateAxiosError } from "./utils.js";
import { HighspotService } from "./service.js";
import { CollectionResponse, HighspotItem, HighspotSpot, HighspotToken, HighspotUser, IdResponse } from "./highspotApiSchema.js";

function getUrlWithParams(urlString: string, queryParams: Record<string, any>) {
    const params = new URLSearchParams(queryParams);
    const url = new URL(urlString);
    url.search = params.toString();
    return url.toString();
}

async function callRestAPI<T>(
    service: HighspotService,
    restUrl: string,
    params: Record<string, any>,
) {
    const token = await service.getAccessToken();
    const config = {
        headers: {
            Authorization: `Bearer ${token.access_token}`,
        },
    };

    const url = getUrlWithParams(restUrl, params);
    try {
        const highspotResult = await axios.get(url, config);
        return highspotResult.data as T;
    } catch (e) {
        translateAxiosError(e, url);
    }
    return undefined;
}

async function postRestAPI<T>(
    service: HighspotService,
    restUrl: string,
    data: any,
) {
    const token = await service.getAccessToken();
    const config = {
        headers: {
            Authorization: `Bearer ${token.access_token}`,
        },
    };

    try {
        const highspotResult = await axios.post(restUrl, data, config);
        return highspotResult.data as T;
    } catch (e) {
        translateAxiosError(e, restUrl);
    }
    return undefined;
}

async function deleteRestAPI<T>(
    service: HighspotService,
    restUrl: string,
) {
    const token = await service.getAccessToken();
    const config = {
        headers: {
            Authorization: `Bearer ${token.access_token}`,
        },
    };

    try {
        const highspotResult = await axios.delete(restUrl, config);
        return highspotResult.data as T;
    } catch (e) {
        translateAxiosError(e, restUrl);
    }
    return undefined;
}

export async function getCurrentUser(service: HighspotService): Promise<HighspotUser | undefined> {
    const userURL = "https://api.latest.highspot.com/v1.0/me";
    const result = await callRestAPI<HighspotUser>(
        service,
        userURL,
        {}
    );
    return result;
}

export async function getItem(
    service: HighspotService,
    itemId: string,
) : Promise<HighspotItem | undefined> {
    const itemURL = `https://api.latest.highspot.com/v1.0/items/${itemId}`;
    const result = await callRestAPI<HighspotItem>(
        service,
        itemURL,
        {}
    );
    return result;
}

export async function getItemContent(
    service: HighspotService,
    itemId: string,
) : Promise<string | undefined> {
    const itemURL = `https://api.latest.highspot.com/v1.0/items/${itemId}/content`;
    const result = await callRestAPI<string>(
        service,
        itemURL,
        {}
    );
    return result;
}

export async function deleteItem(
    service: HighspotService,
    itemId: string,
) : Promise<HighspotItem | undefined> {
    const itemURL = `https://api.latest.highspot.com/v1.0/items/${itemId}`;
    const result = await deleteRestAPI<HighspotItem>(
        service,
        itemURL,
    );
    return result;
}

export async function getOauthToken() : Promise<HighspotToken> {
    const oauthURL = "https://api.latest.highspot.com/v1.0/auth/oauth2/token";
    const clientId = process.env.HIGHSPOT_APP_CLI;
    const clientSecret = process.env.HIGHSPOT_APP_SEC;

    if (!clientId || !clientSecret) {
        throw new Error("Missing HIGHSPOT_APP_CLI or HIGHSPOT_APP_SEC in environment variables.");
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const config = {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${credentials}`,
        },
    };
    const data = new URLSearchParams();
    data.append("grant_type", "client_credentials");

    const tokenResult = await axios.post(oauthURL, data.toString(), config);
    return tokenResult.data as HighspotToken;
}

export async function getSpotItems(
    service: HighspotService,
    spotId: string,
) : Promise<CollectionResponse<HighspotItem> | undefined> {
    const spotItemsURL = `https://api.latest.highspot.com/v1.0/items`;
    const result = await callRestAPI<CollectionResponse<HighspotItem>>(
        service,
        spotItemsURL,
        {
            spot: spotId,
        }
    );
    return result;
}

export async function deleteSpot(
    service: HighspotService,
    spotId: string,
) : Promise<HighspotSpot | undefined> {
    const spotURL = `https://api.latest.highspot.com/v1.0/spots/${spotId}`;
    const result = await deleteRestAPI<HighspotSpot>(
        service,
        spotURL,
    );
    return result;
}

export async function getAllSpots(service: HighspotService) : Promise<CollectionResponse<HighspotSpot> | undefined> {
    const allSpotsURL = "https://api.latest.highspot.com/v1.0/spots";
    const result = await callRestAPI<CollectionResponse<HighspotSpot>>(
        service,
        allSpotsURL,
        {}
    );
    return result;
}

export async function getAllItems(service: HighspotService) : Promise<CollectionResponse<HighspotItem> | undefined> {
    const allItemsURL = "https://api.latest.highspot.com/v1.0/items";
    const result = await callRestAPI<CollectionResponse<HighspotItem>>(
        service,
        allItemsURL,
        {}
    );
    return result;
}

export async function createSpot(
    service: HighspotService,
    title: string,
) : Promise<IdResponse| undefined> {
    const spotURL = "https://api.latest.highspot.com/v1.0/spots";
    const result = await postRestAPI<IdResponse>(
        service,
        spotURL,
        {
            title: title,
        }
    );
    return result;
}
