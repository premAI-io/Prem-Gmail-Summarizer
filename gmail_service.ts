import { OAuth2Client } from "https://deno.land/x/oauth2_client/mod.ts";

interface GmailMessage {
  payload: {
    headers: Array<{
      name: string;
      value: string;
    }>;
  };
}

export class GmailService {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new OAuth2Client({
      clientId: Deno.env.get("GOOGLE_CLIENT_ID")!,
      clientSecret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      redirectUri: "http://localhost:8080/callback",
      authorizationEndpointUri: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUri: "https://oauth2.googleapis.com/token",
      defaults: {
        scope: ["https://www.googleapis.com/auth/gmail.readonly"],
      },
    });
  }

  async getRecentEmails(maxResults = 10) {
    const accessToken = await this.getAccessToken();
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = await response.json();
    const emails = await Promise.all(
      (data.messages ?? []).map((message: { id: string }) =>
        this.getEmailDetails(message.id, accessToken)
      )
    );

    return emails;
  }

  private async getEmailDetails(messageId: string, accessToken: string) {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = await response.json();
    return {
      id: data.id,
      subject: this.getHeader(data, "Subject"),
      from: this.getHeader(data, "From"),
      date: this.getHeader(data, "Date"),
      snippet: data.snippet,
    };
  }

  private getHeader(message: GmailMessage, name: string) {
    return message.payload.headers.find(
      (header) => header.name === name
    )?.value;
  }

  private getAccessToken() {
    // You'll need to implement token management
    // This is a simplified version
    return Deno.env.get("GMAIL_ACCESS_TOKEN")!;
  }
} 