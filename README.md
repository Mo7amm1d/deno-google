# Google

## Drive

A simple google drive index without any external dependencies.

```ts
import { GoogleDrive } from "https://deno.land/x/google/drive.ts";

const gd = new GoogleDrive({
  client_id: "xxxxx-xxxxxxxxxxxxxx.apps.googleusercontent.com",
  client_secret: "xxxxxxxxxxxxxxx",
  refresh_token: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  logger: false,
});

try {
  // This step can be omitted, and it will reauthorize when requesting data
  await gd.authorize();
  // The default value of the path is "root"
  const metadata = await gd.index("your/path");

  if (metadata.isFolder) {
    console.log(metadata.list);
  } else {
    // handle metadata.raw;
  }
} catch (e) {
  console.log(e);
}
```

## OAuth2

NOTE: This module is not strictly tested, especially the jwt verification
method.

### 1. Create an instance

```ts
import { GoogleOAuth2 } from "https://deno.land/x/google/oauth2.ts";

const go = new GoogleOAuth2({
  client_id: "xxxxx-xxxxxxxxxxxxxx.apps.googleusercontent.com",
  client_secret: "xxxxxxxxxxxxxxx",
  redirect_uri: "http://example.com/redirect_uri",
  "scopes": [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/drive.readonly",
  ],
});

const link = go.buildAuthLink();
```

### 2. Visit the link

After clicking the link to complete the authorization, it will redirect to the
uri with the "code" parameter. You can receive the "code" in redirect_uri.

### 3. Get tokens

```ts
// tokens include refresh_token, access_token, id_token, etc.
// But the access_token has an expiry time, so you need to get it again through the next step
const tokens = await go.getTokens(code);
```

### 4. Get access_token

```ts
// refresh_token is obtained in the previous step, it is permanently valid.
const accessToken = go.getAccessToken(refresh_token);
```

### 5. Decode id_token (without verifiy signature)

The id_token obtained in the third step contains some personal information of
the google account, you can decode it.

```ts
const data = go.decodeIdToken(id_token);
// it will return { header, payload, signature }
// payload is the personal information
```

### 6. Decode id_token (verify signature via CERTS_URL)

It is usually not necessary to verify the signature for the first authorization,
but it is strongly recommended to verify when you use the id_token as a cookie
to keep the login state.

```ts
const data = go.verifyIdToken(id_token);
```
