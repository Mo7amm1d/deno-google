import { encodeBase64 } from "https://deno.land/x/jose@v4.10.4/runtime/base64url.ts";
import { MessageBuilder, FileType } from "./helpers/message/MessageBuilder.model.ts";
export { MessageBuilder, FileType };

// deno-lint-ignore-file no-explicit-any
const TOKEN_URL = "https://www.googleapis.com/oauth2/v4/token";
const GMAIL_URL = "https://gmail.googleapis.com/gmail/v1";
const DRIVE_URL = "";
const FILE_ATTRS = "id, name, mimeType, size, modifiedTime, description, iconLink, thumbnailLink, imageMediaMetadata";
const FOLDER_TYPE = "application/vnd.google-apps.folder";

type Options = {
  client_id: string,
  client_secret: string,
  refresh_token: string,
  root_id?: string,
  access_token?: string,
  expires_on?: number,
  logger?: boolean
}

export const GMAIL_SCOPES = {
  /**
   * TODO: Write description here
   */
  USER_INFO : "https://www.googleapis.com/auth/userinfo.email",

  /**
   * Request all permissions.
   */
  GMAIL_ALL: "https://mail.google.com/",

  /**
   * Request modify permission.
   */
  GMAIL_MODIFY: "https://www.googleapis.com/auth/gmail.modify",

  /**
   * Request compose (create) permission.
   */
  GMAIL_COMPOSE: "https://www.googleapis.com/auth/gmail.compose",

  /**
   * Request read-only permission.
   */
  GMAIL_READONLY: "https://www.googleapis.com/auth/gmail.readonly",

  /**
   * Request metadata permission.
   */
  GMAIL_METADATA: "https://www.googleapis.com/auth/gmail.metadata"

}

/**
 * A simple google drive index without any external dependencies
 *
 * export HTTP_PROXY=http://localhost:8889
 * export HTTPS_PROXY=http://localhost:8889
 * @param options
 */
export class Gmail {

  #options: Options;
  #pathCache: any;

  /**
   * Construction and initialization
   * @param options
   */
  constructor(options: Options) {
    options.root_id = options.root_id || "root";
    this.#options = options;
    this.#pathCache = {
      "/": { id: options.root_id, mimeType: FOLDER_TYPE }
    };
  }

  /**
   * Authorize with refresh_token
   * @returns
   */
  async authorize() {
    // Check access_token from cache first
    if (this.#options.expires_on && this.#options.expires_on > Date.now())
      return;

    const time = Date.now();
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: this.#stringify({
        client_id: this.#options.client_id,
        client_secret: this.#options.client_secret,
        refresh_token: this.#options.refresh_token,
        grant_type: "refresh_token"
      })
    });

    const result = await response.json();
    if (result.error) {
      throw { status: response.status, message: result.error_description };
    }

    // The access_token expires 5 minutes earlier than the official api
    this.#options.expires_on = Date.now() + (result.expires_in - 300) * 1000;
    this.#options.access_token = result.access_token;

    if (this.#options.logger) {
      console.log("Gmail authorized:", Date.now() - time, "ms");
    }
  }
  

  /**
   * Get the corresponding data according to the path
   * 1. If it's a directory, return metadata and list() method
   * 2. If it's a file, return metadata and raw() method
   */
  async index(path?: string) {
    let metadata = await this.#getMetadata(path);
    if (!metadata) {
      throw { status: 404, message: "Path not found" };
    }

    metadata = { ...metadata };
    metadata.isFolder = metadata.mimeType === FOLDER_TYPE;
    if (metadata.isFolder) {
      // add list() method to metadata
      metadata.list = async () => {
        const files = await this.#listFiles(metadata.id);
        files.map((item: any) => item.isFolder = item.mimeType === FOLDER_TYPE);
        return files;
      }
    } else {
      // add raw() method to metadata
      metadata.raw = async (range = "") => {
        return await this.#getRawData(metadata.id, range);
      }
    }
    return metadata;
  }

  /**
   * Get file/directory metadata
   * @param path
   * @returns
   */
  async #getMetadata(path = "") {
    path = this.#join("/", path, "/");

    if (!this.#pathCache[path]) {
      let fullPath = "/";
      let metadata = this.#pathCache[fullPath];
      const subpath = this.#trim(path, "/").split("/");

      for (let name of subpath) {
        fullPath += name + "/";

        if (!this.#pathCache[fullPath]) {
          const time = Date.now();

          name = decodeURIComponent(name).replace(/\'/g, "\\'");
          const result: any = await this.#request({
            q: `'${metadata.id}' in parents and name = '${name}' and trashed = false`,
            fields: `files(${FILE_ATTRS})`,
          });

          this.#pathCache[fullPath] = result.files[0];
          if (this.#options.logger) {
            console.log(`Metadata of "${fullPath}" requested:`, Date.now() - time, "ms");
          }
        }
        metadata = this.#pathCache[fullPath];
        if (!metadata) break;
      }
    }
    return this.#pathCache[path];
  }

  /**
   * Get the rawdata by file id.
   * @param userGmail
   * @returns
   */
   async getProfile(userGmail: string) {
    const time = Date.now();
    await this.authorize();
    console.log(GMAIL_URL + "/users/" + userGmail + "/profile");
    const response = await fetch(GMAIL_URL + "/users/" + userGmail + "/profile", {
      headers: {
        Authorization: "Bearer " + this.#options.access_token,
      }
    });

    if (response.status >= 400) {
      const result = await response.json();
      throw { status: response.status, message: result.error.message };
    }

    if (this.#options.logger) {
      console.log(`Profile of "${userGmail}" requested:`, Date.now() - time, "ms");
    }
    
    return response.json();
  }

  /**
   * Get the rawdata by file id.
   * @param userGmail
   * @returns
   */
   
  async getMessages(userGmail: string, maxResults: number|null = 100) {
    const time = Date.now();
    await this.authorize();
    
    const response = await fetch(`${GMAIL_URL}/users/${userGmail}/messages`, {
      method: 'GET',
      headers: {
        Authorization: "Bearer " + this.#options.access_token,
      }
    });

    if (response.status >= 400) {
      const result = await response.json();
      throw { status: response.status, message: result.error.message };
    }

    if (this.#options.logger) {
      console.log(`Profile of "${userGmail}" requested:`, Date.now() - time, "ms");
    }
    
    return response.json();
  }

  async getDrafts(userGmail: string, maxResults: number|null = 100) {
    const time = Date.now();
    await this.authorize();
    
    const response = await fetch(`${GMAIL_URL}/users/${userGmail}/drafts`, {
      method: 'GET',
      headers: {
        Authorization: "Bearer " + this.#options.access_token,
      }
    });

    if (response.status >= 400) {
      const result = await response.json();
      throw { status: response.status, message: result.error.message };
    }

    if (this.#options.logger) {
      console.log(`Drafts of "${userGmail}" requested:`, Date.now() - time, "ms");
    }
    
    return response.json();
  }

  async getDraftById(userGmail: string, draftId: string) {
    const time = Date.now();
    await this.authorize();
    
    const response = await fetch(`${GMAIL_URL}/users/${userGmail}/drafts/${draftId}`, {
      method: 'GET',
      headers: {
        Authorization: "Bearer " + this.#options.access_token,
      }
    });

    if (response.status >= 400) {
      const result = await response.json();
      throw { status: response.status, message: result.error.message };
    }

    if (this.#options.logger) {
      console.log(`Drafts of "${userGmail}" requested:`, Date.now() - time, "ms");
    }
    
    return response.json();
  }

  async createDraft(userGmail: string, message: MessageBuilder) {
    const time = Date.now();
    await this.authorize();
    
    // https://gmail.googleapis.com/gmail/v1/users/{userId}/messages/send
    /* POST 
      {
        "id": string,
        "threadId": string,
        "labelIds": [
          string
        ],
        "snippet": string,
        "historyId": string,
        "internalDate": string,
        "payload": {
          object (MessagePart)
        },
        "sizeEstimate": integer,
        "raw": string
      }
    */
   // POST https://gmail.googleapis.com/gmail/v1/users/{userId}/drafts
      console.log("Hitting", `${GMAIL_URL}/users/${userGmail}/drafts`);
    const response = await fetch(`${GMAIL_URL}/users/${userGmail}/drafts`, {
      method: 'POST',
      headers: {
        Authorization: "Bearer " + this.#options.access_token,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }, 
      body: JSON.stringify({
        message: {
          raw: message.build()
        }
      })
    });

    if (response.status >= 400) {
      const result = await response.json();
      throw { status: response.status, message: result.error.message };
    }

    if (this.#options.logger) {
      console.log(`Profile of "${userGmail}" requested:`, Date.now() - time, "ms");
    }
    
    return response.json();
  }

  async sendMessage(userGmail: string, message: MessageBuilder) {
    const time = Date.now();
    await this.authorize();
    
    // const baseUrl = message.hasAttachment() ? `https://gmail.googleapis.com/upload/gmail/v1/users/${userGmail}/messages/send` : `${GMAIL_URL}/users/${userGmail}/messages/send`;
    const baseUrl = `${GMAIL_URL}/users/${userGmail}/messages/send`;
    console.log(message.hasAttachment(), baseUrl);
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: "Bearer " + this.#options.access_token,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }, 
      body: JSON.stringify({
        raw: message.build()
      })
    });

    if (response.status >= 400) {
      const result = await response.json();
      throw { status: response.status, message: result.error.message };
    }

    if (this.#options.logger) {
      console.log(`Send Message from "${userGmail}" requested:`, Date.now() - time, "ms");
    }
    
    return response.json();
  }
  
  /**
   * Get the rawdata by file id.
   * @param userGmail
   * @returns
   */
   async getHistory(userGmail: string) {
    const time = Date.now();
    await this.authorize();
    
    const response = await fetch(`${GMAIL_URL}/users/${userGmail}/history`, {
      method: 'GET',
      headers: {
        Authorization: "Bearer " + this.#options.access_token,
      }
    });

    if (response.status >= 400) {
      const result = await response.json();
      throw { status: response.status, message: result.error.message };
    }

    if (this.#options.logger) {
      console.log(`Profile of "${userGmail}" requested:`, Date.now() - time, "ms");
    }
    
    return response.json();
  }


  /**
   * Get the rawdata by file id.
   * @param id
   * @param range
   * @returns
   */
  async #getRawData(id: string, range = "") {
    const time = Date.now();
    await this.authorize();

    const response = await fetch(DRIVE_URL + "/" + id + "?alt=media", {
      headers: {
        Authorization: "Bearer " + this.#options.access_token,
        Range: range
      }
    });

    if (response.status >= 400) {
      const result = await response.json();
      throw { status: response.status, message: result.error.message };
    }
    if (this.#options.logger) {
      console.log(`Rawdata of "${id}" requested:`, Date.now() - time, "ms");
    }
    return response.body;
  }

  /**
   * Get all files in the specified directory
   * @param id
   * @returns
   */
  async #listFiles(id: string) {
    let pageToken;
    const list = [];
    const params = {
      pageToken: 0, pageSize: 1000,
      q: `'${id}' in parents and trashed = false AND name != '.password'`,
      fields: `nextPageToken, files(${FILE_ATTRS})`,
      orderBy: "folder, name"
    };

    do {
      if (pageToken) params.pageToken = pageToken;

      const time = Date.now();
      const result: any = await this.#request(params);
      if (this.#options.logger) {
        console.log(`Filelist of "${id}" requested:`, Date.now() - time, "ms");
      }

      pageToken = result.nextPageToken;
      list.push(...result.files);
    } while (
      pageToken
    )
    return list;
  }

  /**
   * Request google drive
   * @param params
   * @returns
   */
  async #request(params: Record<string, string | number | boolean>): Promise<unknown> {
    await this.authorize();

    const response = await fetch(DRIVE_URL + "?" + this.#stringify(params), {
      headers: { Authorization: "Bearer " + this.#options.access_token }
    });

    const result = await response.json();
    if (result.error) {
      // Continue requesting when access frequency is exceeded
      if (result.error.message.startsWith("User Rate Limit Exceeded")) {
        return await this.#request(params);
      }
      throw { status: response.status, message: result.error.message };
    }
    return result;
  }

  /**
   * Convert object to querystring
   * @param p
   * @returns
   */
  #stringify(p: Record<string, string | number | boolean>) {
    const qs: string[] = [];
    for (const k in p) {
      if (p[k]) qs.push(encodeURIComponent(k) + "=" + encodeURIComponent(p[k]));
    }
    return qs.join("&");
  }

  /**
   * Path joiner
   * Make sure there is only one consecutive slash in the path
   * @param paths
   * @returns
   */
  #join(...paths: string[]): string {
    return paths.join("").replace(/\/+/g, "/");
  }

  /**
   * Remove the specified characters from the left and right sides of the string
   * @param string
   * @param char
   * @returns
   */
  #trim(string: string, char?: string) {
    return char ?
      string.replace(new RegExp("^\\" + char + "+|\\" + char + "+$", "g"), "") :
      string.replace(/^\s+|\s+$/g, "");
  }

}
