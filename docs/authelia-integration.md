# Authelia Integration

This guide explains how to protect DeepCrate with [Authelia](https://www.authelia.com/) for advanced authentication features like:

- Single Sign-On (SSO)
- Two-Factor Authentication (2FA)
- LDAP/Active Directory integration
- Session management
- Access control policies

## Architecture

Authelia works as a forward authentication server with your reverse proxy (Caddy, nginx, Traefik, etc.):

```
┌─────────┐     ┌──────────────┐     ┌──────────┐     ┌───────────┐
│ Browser │────►│ Reverse Proxy│────►│ Authelia │────►│ DeepCrate │
│         │     │ (Caddy/nginx)│     │          │     │           │
└─────────┘     └──────────────┘     └──────────┘     └───────────┘
                       │                   │
                       │   Forward Auth    │
                       │◄──────────────────┘
                       │
                       │   Verified? Pass through
                       └──────────────────────────────►
```

## Prerequisites

- Authelia deployed and running
- Reverse proxy (Caddy, nginx, or Traefik)
- DNS configured for your domain
- SSL certificates (automatic with Caddy, manual with nginx/Traefik)

## DeepCrate Configuration

When using Authelia, disable DeepCrate's built-in auth:

```yaml
# config.yaml
ui:
  auth:
    enabled: false  # Let Authelia handle auth
```

Or set to trust the proxy headers:

```yaml
ui:
  auth:
    enabled: true
    type: "proxy"
    trusted_headers:
      - "Remote-User"
      - "Remote-Groups"
```

**Note:** When `type: "proxy"` is set, the DeepCrate UI will:
1. Detect the auth mode via `/api/v1/auth/info`
2. Skip the login form and auto-redirect to the dashboard
3. Display the username from the `Remote-User` header (set by Authelia)

## Caddy Configuration

### Basic Forward Auth Setup

```caddy
# /etc/caddy/Caddyfile

deepcrate.example.com {
    # Automatic HTTPS with Let's Encrypt
    
    # Forward auth to Authelia for all requests except health
    @notHealth {
        not path /health
    }
    
    forward_auth @notHealth authelia:9091 {
        uri /api/verify?rd=https://auth.example.com
        copy_headers Remote-User Remote-Groups Remote-Name Remote-Email
    }
    
    # Proxy to DeepCrate
    reverse_proxy deepcrate:8080
}
```

### Advanced Configuration with Path-Specific Rules

```caddy
# /etc/caddy/Caddyfile

deepcrate.example.com {
    # Root path - protected by Authelia
    @authenticated {
        not path /health
    }
    
    forward_auth @authenticated authelia:9091 {
        uri /api/verify?rd=https://auth.example.com
        copy_headers Remote-User Remote-Groups Remote-Name Remote-Email
    }
    
    # API endpoints - also protected
    handle /api/* {
        reverse_proxy deepcrate:8080
    }
    
    # Health endpoint - no auth required
    handle /health {
        reverse_proxy deepcrate:8080
    }
    
    # Everything else
    handle {
        reverse_proxy deepcrate:8080
    }
}
```

## nginx Configuration

If you prefer nginx over Caddy:

### Basic Forward Auth Setup

```nginx
# /etc/nginx/conf.d/deepcrate.conf

server {
    listen 443 ssl http2;
    server_name deepcrate.example.com;

    ssl_certificate /etc/ssl/certs/example.com.crt;
    ssl_certificate_key /etc/ssl/private/example.com.key;

    # Authelia forward auth
    include /etc/nginx/includes/authelia-location.conf;

    location / {
        # Protect with Authelia
        include /etc/nginx/includes/authelia-authrequest.conf;

        # Proxy to DeepCrate
        proxy_pass http://deepcrate:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Pass auth headers from Authelia
        proxy_set_header Remote-User $upstream_http_remote_user;
        proxy_set_header Remote-Groups $upstream_http_remote_groups;
        proxy_set_header Remote-Name $upstream_http_remote_name;
        proxy_set_header Remote-Email $upstream_http_remote_email;
    }

    # API endpoints - also protected
    location /api/ {
        include /etc/nginx/includes/authelia-authrequest.conf;

        proxy_pass http://deepcrate:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Remote-User $upstream_http_remote_user;
    }

    # Health endpoint - no auth required
    location /health {
        proxy_pass http://deepcrate:8080;
    }
}
```

### Authelia Include Files for nginx

Create these shared includes:

```nginx
# /etc/nginx/includes/authelia-location.conf

location /authelia {
    internal;
    set $upstream_authelia http://authelia:9091/api/verify;
    proxy_pass $upstream_authelia;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header X-Original-URL $scheme://$http_host$request_uri;
    proxy_set_header X-Forwarded-Method $request_method;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $http_host;
    proxy_set_header X-Forwarded-Uri $request_uri;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Real-IP $remote_addr;
}
```

```nginx
# /etc/nginx/includes/authelia-authrequest.conf

auth_request /authelia;
auth_request_set $target_url $scheme://$http_host$request_uri;
auth_request_set $user $upstream_http_remote_user;
auth_request_set $groups $upstream_http_remote_groups;
auth_request_set $name $upstream_http_remote_name;
auth_request_set $email $upstream_http_remote_email;
error_page 401 =302 https://auth.example.com/?rd=$target_url;
```

## Authelia Configuration

### Access Control Policy

Add DeepCrate to your Authelia access control:

```yaml
# authelia/configuration.yml

access_control:
  default_policy: deny
  rules:
    # DeepCrate - require authentication
    - domain: deepcrate.example.com
      policy: one_factor  # or two_factor for 2FA

    # DeepCrate API - require authentication
    - domain: deepcrate.example.com
      resources:
        - "^/api/.*"
      policy: one_factor

    # Health endpoint - bypass auth
    - domain: deepcrate.example.com
      resources:
        - "^/health$"
      policy: bypass
```

### Two-Factor Authentication

For 2FA on DeepCrate:

```yaml
access_control:
  rules:
    - domain: deepcrate.example.com
      policy: two_factor
```

### Group-Based Access

Restrict to specific groups:

```yaml
access_control:
  rules:
    - domain: deepcrate.example.com
      policy: one_factor
      subject:
        - "group:music_admins"
```

## Docker Compose Example

Complete example with Caddy, Authelia, and DeepCrate:

```yaml
# docker-compose.yaml

services:
  caddy:
    image: caddy:2-alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    networks:
      - deepcrate-net
    depends_on:
      - authelia
      - deepcrate

  authelia:
    image: authelia/authelia:latest
    volumes:
      - ./authelia:/config
    networks:
      - deepcrate-net
    environment:
      - TZ=America/New_York

  deepcrate:
    image: ghcr.io/jordojordo/deepcrate:latest
    volumes:
      - ./deepcrate/config.yaml:/config/config.yaml:ro
      - ./deepcrate/data:/data
    networks:
      - deepcrate-net

networks:
  deepcrate-net:

volumes:
  caddy-data:
  caddy-config:
```

## nginx Docker Compose Example

Complete example with nginx, Authelia, and DeepCrate:

```yaml
# docker-compose.yaml

services:
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/includes:/etc/nginx/includes:ro
      - ./ssl:/etc/ssl:ro
    networks:
      - deepcrate-net
    depends_on:
      - authelia
      - deepcrate

  authelia:
    image: authelia/authelia:latest
    volumes:
      - ./authelia:/config
    networks:
      - deepcrate-net
    environment:
      - TZ=America/New_York

  deepcrate:
    image: ghcr.io/jordojordo/deepcrate:latest
    volumes:
      - ./deepcrate/config.yaml:/config/config.yaml:ro
      - ./deepcrate/data:/data
    networks:
      - deepcrate-net
    environment:
      - TZ=America/New_York

networks:
  deepcrate-net:
```

## Traefik Configuration

If using Traefik:

```yaml
# docker-compose.yaml (Traefik labels)

services:
  deepcrate:
    image: ghcr.io/jordojordo/deepcrate:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.deepcrate.rule=Host(`deepcrate.example.com`)"
      - "traefik.http.routers.deepcrate.entrypoints=websecure"
      - "traefik.http.routers.deepcrate.tls=true"
      - "traefik.http.routers.deepcrate.middlewares=authelia@docker"
      - "traefik.http.services.deepcrate.loadbalancer.server.port=8080"
```

## Verifying Integration

### Test Authentication Flow

1. Visit `https://deepcrate.example.com`
2. Should redirect to Authelia login
3. Log in with your credentials
4. Should redirect back to DeepCrate

### Test API Access

```bash
# Without auth - should fail
curl https://deepcrate.example.com/api/v1/queue/pending
# Returns: 401 Unauthorized

# With Authelia session cookie - should work
curl -b "authelia_session=..." https://deepcrate.example.com/api/v1/queue/pending
```

### Check Headers

Verify Authelia headers reach DeepCrate:

```bash
docker logs deepcrate | grep "Remote-User"
```

## Troubleshooting

### 401 Unauthorized

- Check Authelia is running: `docker logs authelia`
- Verify reverse proxy forward auth config:
  - **Caddy:** Check `forward_auth` directive
  - **nginx:** Verify `auth_request` and include files
  - **Traefik:** Check `forwardAuth` middleware
- Check Authelia access control policy

### Redirect Loop

- Ensure health endpoint bypasses auth
- Verify forward auth configuration:
  - **Caddy:** Check `@notHealth` matcher excludes `/health`
  - **nginx:** Ensure `/health` location has no `auth_request`
  - **Traefik:** Use path-based middleware exclusion

### Headers Not Passed

- Verify header forwarding configuration:
  - **Caddy:** Check `copy_headers` directive
  - **nginx:** Verify `auth_request_set` and `proxy_set_header` directives
  - **Traefik:** Check `authResponseHeaders` in middleware
- Check Authelia is returning the expected headers
- Ensure DeepCrate is configured for proxy auth

### Session Issues

- Check Authelia session domain matches
- Verify cookies are being set correctly
- Check browser developer tools for cookie issues

## Security Considerations

1. **Always use HTTPS** - Authelia requires secure cookies
2. **Set strong session secrets** - In Authelia configuration
3. **Enable 2FA for admin users** - Extra security layer
4. **Restrict by IP if possible** - Additional access control
5. **Monitor access logs** - Track who's accessing DeepCrate

## Additional Resources

### Authelia
- [Authelia Documentation](https://www.authelia.com/docs/)
- [Authelia Caddy Integration](https://www.authelia.com/integration/proxies/caddy/)
- [Authelia nginx Integration](https://www.authelia.com/integration/proxies/nginx/)
- [Authelia Traefik Integration](https://www.authelia.com/integration/proxies/traefik/)

### Reverse Proxies
- [Caddy Documentation](https://caddyserver.com/docs/)
- [nginx Documentation](https://nginx.org/en/docs/)
- [Traefik Documentation](https://doc.traefik.io/traefik/)
