/** What a server action returns: ok with its extra fields, or a message to show. Never throws. */
export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }
