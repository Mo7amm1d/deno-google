// import { encodeBase64 } from "https://deno.land/x/jose@v4.10.4/runtime/base64url.ts";

import { encodeBase64 } from "https://deno.land/x/jose@v4.10.4/runtime/base64url.ts";

/*
POST https://gmail.googleapis.com/gmail/v1/users/m07.testing%40gmail.com/drafts?key=[YOUR_API_KEY] HTTP/1.1

Authorization: Bearer [YOUR_ACCESS_TOKEN]
Accept: application/json
Content-Type: application/json

{
  "message": {
    "raw": ""
  }
}

*/

class FileType {
    static PDF = "application/pdf";
    // static JPG = "image/jpeg";
}

class MessageBuilder {

    // Using raw to simplify the library
    private _senderDisplayName = "";
    private _senderEmail = "";
    private _recievers: string[] = [];
    private _recieversCcs: string[] = [];
    private _recieversBccs: string[] = [];

    private _subject = "";
    private _message = "";

    private _file: Uint8Array|null = null;
    private _fileType: FileType|null = null;
    private _fileNameWithExtension: string|null = null;

    hasAttachment(): boolean {
        return this._file != null;
    }
    
    setSenderName(name: string){
        this._senderDisplayName = name;
        return this;
    }

    setSenderEmail(email: string){
        this._senderEmail = email;
        return this;
    }

    setReceivers(emails: string[]){
        this._recievers = emails;
        return this;
    }

    setCcs(emails: string[]){
        this._recieversCcs = emails;
        return this;
    }

    setBccs(emails: string[]){
        this._recieversBccs = emails;
        return this;
    }

    setSubject(subject: string){
        this._subject = subject;
        return this;
    }

    setMessage(message: string){
        this._message = message;
        return this;
    }
    
    // Lets test it with a single attachment for now.
    withAttachment(file: Uint8Array, fileType: FileType, fileNameWithExtension: string){
        this._file = file;
        this._fileType = fileType;
        this._fileNameWithExtension = fileNameWithExtension;
        return this;
    }

     _createRequest(){
        const _boundary = crypto.randomUUID();

        if(this._file != null){
            return `Subject: ${this._subject}
From: ${this._senderDisplayName != null ? `${this._senderDisplayName}<${this._senderEmail}>` : `${this._senderEmail}`} 
To: ${this._recievers.join(',')}
Bcc: ${this._recieversBccs.join(',')}
Cc: ${this._recieversCcs.join(',')}
Content-Type: multipart/mixed; boundary="${_boundary}"

--${_boundary}
Content-Type: text/plain; charset="UTF-8"

${this._message}

--${_boundary}
Content-Type: ${this._fileType}; name="${this._fileNameWithExtension}"
Content-Disposition: attachment; filename="${this._fileNameWithExtension}"
Content-Transfer-Encoding: base64

${encodeBase64(this._file!)}
--${_boundary}--`;
        }

        
        return `Subject: ${this._subject}
From: ${this._senderDisplayName != null ? `${this._senderDisplayName}<${this._senderEmail}>` : `${this._senderEmail}`} 
To: ${this._recievers.join(',')}
Bcc: ${this._recieversBccs.join(',')}
Cc: ${this._recieversCcs.join(',')}
Content-Type: text/plain; charset="UTF-8"

${this._message}`;
    }

    build(){
        return encodeBase64(this._createRequest());
    }
    

    
    
}


export { MessageBuilder, FileType };