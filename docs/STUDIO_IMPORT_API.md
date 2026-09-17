# Uploading problems from another app

Any app that produces `.henryproblem` files can put them into the classroom's
problem bank with one HTTP request per file. This page is the whole contract,
with clients you can copy.

- **Endpoint:** `POST https://henrymathclassroom.com/api/studio/import`
- **Auth:** an import key, or a teacher's Supabase access token, as a Bearer token
- **Body:** the `.henryproblem` file, optionally with its cropped diagram
- **Reply:** the bank row's id, so a later edit updates instead of duplicating

The route reads only the `Authorization` header and never a cookie, and it
answers cross-origin requests, so a browser-based app can call it directly.

## 1. Get a key

The fastest path for a one-click button. Two environment variables on the
site, set in the Vercel project settings, then redeploy:

| Variable | Value |
|---|---|
| `STUDIO_IMPORT_KEY` | a long random secret. Make one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `STUDIO_IMPORT_TEACHER` | the teacher the uploads belong to, as an email or a user id |

Give the same key to the app, in its settings, never in its source. The key is
a teacher's full power over the bank: anyone holding it can add, update, and
read bank problems. It cannot touch students, grades, or anything else.

Prefer not to hold a key? The alternative is a teacher's own session token,
described at the end.

## 2. Send a file

```http
POST /api/studio/import
Authorization: Bearer <STUDIO_IMPORT_KEY>
Content-Type: application/json

{ "snapshot": "<the .henryproblem file contents, as a JSON string>" }
```

`snapshot` can be the raw file text or the parsed object; both are read with
the same parser the website's own importer uses. The reply:

```json
{ "id": "…", "created": true, "imageUrl": "…", "tagIds": ["…"], "skippedTags": [] }
```

- `201` means a new row was created, `200` that an existing one was updated.
- `tagIds` are the tags attached: existing tags are matched by name in either language, new ones are created.
- `skippedTags` names any tag that could not be created; the problem is still saved.

### Optional fields

| Field | Meaning |
|---|---|
| `bankId` | Update this row instead of inserting. Use the `id` you got back earlier. |
| `revision` | Your own content hash. Stored on the row, and returned by the listing below, so you can tell what is current. |
| `image` | `{ "base64": "…", "contentType": "image/png" }`: the diagram, already cropped. See the rule below. |
| `title` | Overrides the snapshot's title. |
| `maxPoints` | Overrides the snapshot's score, as a whole number. |
| `extraTagIds` | Tag ids to add on top of the snapshot's own tags. |

### The diagram rule

A snapshot stores the whole original image plus a crop rectangle, and the
website shows exactly the picture it is given without cropping. So:

- **Full-frame crop, or no crop:** send the raw file. The embedded graph is used as is.
- **Partial crop:** crop the picture yourself and send it as `image`. The route refuses a partial crop without a picture, with a sentence saying so.
- **Big graphs:** the picture must be under 3 MB decoded, and the whole request under about 4 MB. Downscale to a long edge of 1600 px and set `"graph": null` in the snapshot you send.

## 3. Find what is already there

```http
GET /api/studio/import?basename=Exponent%2011
Authorization: Bearer <key>
```

returns `{ "items": [ { "id", "title", "sourceBasename", "sourceRevision", "imageUrl", "updatedAt" } ] }`
for rows whose snapshot had that `output_basename`. Without `basename` it lists
every row that came from a snapshot, newest first, up to a thousand.

## 4. The one-click button

What the button does, per file that is new or changed since it was last sent:

1. `POST` the file. Include `bankId` if you have one for it.
2. Store the returned `id` and your `revision` beside the file.
3. Show the sentence from `error` if the reply is not 2xx.

Send files one after another rather than all at once. Two parallel requests
that both introduce the same new tag can create it twice. A request takes well
under a second.

## Errors

| Status | Meaning |
|---|---|
| 400 | The snapshot could not be read, or the diagram needs cropping. `error` says which. |
| 401 | No key or token, or a token that has expired. |
| 403 | A valid token, but not a teacher's. |
| 413 | The picture is over 3 MB. |
| 500 | The key is set but its teacher is not, or the server failed. |

## Clients

### curl

```bash
curl -X POST https://henrymathclassroom.com/api/studio/import \
  -H "Authorization: Bearer $STUDIO_IMPORT_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @<(node -e "console.log(JSON.stringify({snapshot: require('fs').readFileSync(process.argv[1],'utf8')}))" "Exponent 11.henryproblem")
```

### Node

`docs/examples/henry-import.mjs` is a complete client and command line with no
dependencies:

```bash
STUDIO_IMPORT_KEY=… node docs/examples/henry-import.mjs "Algebra/Exponent 11.henryproblem"
```

or, from your own code:

```js
import { importHenryProblem } from './henry-import.mjs'
const result = await importHenryProblem({
  site: 'https://henrymathclassroom.com',
  token: process.env.STUDIO_IMPORT_KEY,
  snapshotText: await fs.readFile(path, 'utf8'),
  bankId: savedId,        // optional
  revision: myHash,       // optional
})
```

### Python

Standard library only:

```python
import json, urllib.request

def upload(path, key, site="https://henrymathclassroom.com", bank_id=None, revision=None):
    body = {"snapshot": open(path, encoding="utf-8").read()}
    if bank_id: body["bankId"] = bank_id
    if revision: body["revision"] = revision
    request = urllib.request.Request(
        f"{site}/api/studio/import",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)          # {"id": ..., "created": ...}
    except urllib.error.HTTPError as error:
        raise RuntimeError(json.load(error).get("error", f"HTTP {error.code}")) from None
```

If your app already has the Prettify Homework tools, `tools/site_upload.py`
does all of this plus cropping and downscaling.

### Browser

The route allows any origin, so `fetch` from a web app works as-is. Remember
that a key placed in browser code is visible to anyone who can open the app.

## Using a teacher's token instead of a key

For an app that signs the teacher in itself. Get a token from Supabase Auth:

```http
POST https://<project>.supabase.co/auth/v1/token?grant_type=password
apikey: <anon key>
Content-Type: application/json

{ "email": "<teacher email>", "password": "<password>" }
```

The reply's `access_token` is the Bearer token for an hour; `refresh_token`
gets a new one at `?grant_type=refresh_token`. Sign in once and reuse the token:
Supabase refuses too many sign-ins from one network in a short window. The
project URL and anon key are the public `NEXT_PUBLIC_SUPABASE_*` values from
the site's `.env.local`.
