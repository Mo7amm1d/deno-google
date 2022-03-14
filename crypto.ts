import { encode as encodeBase64Url, decode as decodeBase64Url }
    from "https://deno.land/std@0.129.0/encoding/base64url.ts";

const textEncode = (s: string) => new TextEncoder().encode(s);
const textDecode = (u: Uint8Array) => new TextDecoder().decode(u);

const importKey = async (key: string) => {
    const digest = await crypto.subtle.digest("SHA-1", textEncode(key));
    const rawKey = new Uint8Array(digest).slice(0, 16);

    return await crypto.subtle.importKey(
        "raw", rawKey, "AES-CBC", true, ["encrypt", "decrypt"]
    );
}

/**
 * AES encryption and decryption of specific algorithms
 * algorithm: AES-CBC
 * encoding: base64url
 */
export const AES = {
    /**
     * Encryptor
     * @param plaintext
     * @param key
     * @returns
     */
    async encrypt(plaintext: string, key: string) {
        const iv = await crypto.getRandomValues(new Uint8Array(16));
        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-CBC", iv }, await importKey(key),
            textEncode(plaintext)
        );
        return encodeBase64Url(iv) + '/' + encodeBase64Url(encrypted);
    },

    /**
     * Decryptor
     * @param decrypted
     * @param key
     * @returns
     */
    async decrypt(encrypted: string, key: string) {
        const index = encrypted.indexOf("/");
        const iv = decodeBase64Url(encrypted.substring(0, index));
        try {
            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-CBC", iv }, await importKey(key),
                decodeBase64Url(encrypted.substring(index + 1))
            );
            return textDecode(new Uint8Array(decrypted));
        } catch (e) {
            console.error(e);
        }
    }

}