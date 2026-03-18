# Webhooks

DeepCrate can send HTTP webhooks when key events occur, letting you integrate with external services like Discord, Slack, Home Assistant, or custom automation pipelines.

## Supported Events

| Event | Fired When |
|-------|------------|
| `download_completed` | An album or track finishes downloading via slskd |
| `queue_approved` | A queue item is approved (moved to wishlist) |
| `queue_rejected` | A queue item is rejected |

## Configuration

Add a `webhooks` array to your `config.yaml`:

```yaml
webhooks:
  - name: "discord"
    enabled: true
    url: "https://discord.com/api/webhooks/..."
    secret: "my-signing-secret"     # optional
    events:
      - download_completed
      - queue_approved
    timeout_ms: 10000               # default: 10000 (10s), max: 30000
    retry: 2                        # default: 0, max: 5
```

### Configuration Reference

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `name` | string | Yes | - | Display name for logging |
| `enabled` | bool | No | `true` | Enable/disable this webhook |
| `url` | string | Yes | - | HTTP(S) endpoint to POST to |
| `secret` | string | No | - | HMAC-SHA256 signing secret |
| `events` | string[] | Yes | - | Events to subscribe to (at least one) |
| `timeout_ms` | number | No | `10000` | Request timeout in milliseconds (max 30000) |
| `retry` | number | No | `0` | Number of retry attempts on failure (max 5) |

## Payload Format

Every webhook POST sends a JSON body with this structure:

```json
{
  "event": "download_completed",
  "timestamp": "2026-03-18T12:00:00.000Z",
  "data": {
    "artist": "Boards of Canada",
    "album": "Music Has the Right to Children",
    "download_path": "/music/Boards of Canada/Music Has the Right to Children",
    "mbid": "a1b2c3d4-e5f6-..."
  }
}
```

The `data` fields are optional and vary by event:

| Field | Events |
|-------|--------|
| `artist` | All |
| `album` | All |
| `download_path` | `download_completed` |
| `mbid` | All (when available) |

## Signature Verification

When a `secret` is configured, DeepCrate includes an `X-Webhook-Signature` header containing an HMAC-SHA256 hex digest of the raw JSON body.

To verify the signature on your receiving end:

```javascript
import crypto from 'crypto';

function verifySignature(body, secret, signature) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
}

// In your request handler:
const raw = JSON.stringify(req.body);
const sig = req.headers['x-webhook-signature'];

if (!verifySignature(raw, 'my-signing-secret', sig)) {
  return res.status(401).send('Invalid signature');
}
```

## Retry Behavior

When a webhook delivery fails (network error or non-2xx response), DeepCrate retries using exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1st retry | 2 seconds |
| 2nd retry | 4 seconds |
| 3rd retry | 8 seconds |
| 4th retry | 16 seconds |
| 5th retry | 32 seconds |

Set `retry: 0` to disable retries entirely.

## Testing

### From the UI

The webhooks settings page includes **Test** and **Dry Run** buttons for each configured webhook:

- **Test**: sends a sample `download_completed` payload to the URL and reports the result
- **Dry Run**: returns the payload that would be sent, without making an HTTP call

### From the API

```bash
# Live test
curl -X POST http://localhost:8080/api/v1/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/webhook",
    "secret": "my-secret",
    "timeout_ms": 5000,
    "dry_run": false
  }'

# Dry run
curl -X POST http://localhost:8080/api/v1/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/webhook",
    "dry_run": true
  }'
```

See the [API Reference](/reference/api) for full endpoint documentation.
