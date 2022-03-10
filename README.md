# Google

## Drive

A simple google drive index without any external dependencies.

```
import { GoogleDrive } from "https://deno.land/x/google/drive.ts";

const gd = new GoogleDrive({
    client_id: "xxxxx-xxxxxxxxxxxxxx.apps.googleusercontent.com",
    client_secret: "xxxxxxxxxxxxxxx",
    refresh_token: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
});

try {
    await gd.authorize();
    const result = await gd.index("your/path"); // default root
    console.log(result);
} catch (e) {
    console.log(e)
}
```
