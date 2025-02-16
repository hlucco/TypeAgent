import { getOauthToken } from "./endpoints.js";
import { HighspotToken, HighspotUser } from "./highspotApiSchema.js";


export class HighspotService {
    private loggedInUser: HighspotUser | null;
    private accessToken: HighspotToken | null;

    constructor() {
        this.loggedInUser = null;
        this.accessToken = null;
        this.getAccessToken();
    }

    retrieveUser(): HighspotUser {
        if (this.loggedInUser === null) {
            throw new Error("Highspot Service: no loggedInUser");
        }
        return this.loggedInUser;
    }

    storeUser(user: HighspotUser) {
        this.loggedInUser = user;
    }

    async getAccessToken(): Promise<HighspotToken> {
        if (this.accessToken !== null) {
            return this.accessToken;
        }
        this.accessToken = await getOauthToken();
        return this.accessToken;
    }
}