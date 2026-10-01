# A rule's `ref` keeps its id across edits. Imported rules use their original id; give a new rule a readable slug.

resource "cloudflare_ruleset" "custom_firewall" {
  zone_id = local.zone_id
  name    = "default"
  kind    = "zone"
  phase   = "http_request_firewall_custom"
  rules = [
    {
      ref         = "cd190ddb60944dcdb4ca390ed33545bb"
      description = "CF Bypass"
      expression  = "(any(http.request.headers[\"x-cf-bypass-token\"][*] eq \"${var.cf_bypass_token}\")) or (http.request.uri.path contains \"/_zeabur\") or (http.request.uri.path contains \"/robots.txt\") or (http.request.uri.path eq \"/.well-known/webauthn\") or (cf.client.bot) or (http.request.uri.path contains \"/.well-known/vercel\") or (http.request.uri.path contains \"/.well-known/acme-challenge/zeabur\") or (http.request.uri.path contains \"/.well-known/acme-challenge/vercel\") or (http.request.uri.path contains \"/.well-known/acme-challenge/__resolve-check\") or (http.request.uri.path contains \"/.well-known/discord\") or (http.request.uri.path wildcard r\"/.well-known/*\") or (cf.verified_bot_category in {\"Search Engine Crawler\" \"AI Crawler\" \"AI Search\" \"AI Assistant\"})"
      action      = "skip"
      action_parameters = {
        phases   = ["http_ratelimit", "http_request_firewall_managed", "http_request_sbfm"]
        products = ["bic", "hot", "rateLimit", "waf", "uaBlock"]
        ruleset  = "current"
      }
      logging = {
        enabled = true
      }
      enabled = true
    },
    {
      ref         = "40960072f34d4ed69615a4030bcdffa4"
      description = "scanner block"
      expression  = "(http.user_agent contains \"python\") or (http.user_agent contains \"Go-http-client\") or (http.user_agent contains \"paloaltonetworks\") or (starts_with(http.request.uri.path, \"//\")) or (http.request.uri.path contains \".php\") or (http.request.uri.path contains \".env\") or (http.request.uri.path contains \"/.git\") or (http.request.uri.path contains \".idea\") or (http.request.uri.path contains \".vscode\") or (http.request.uri.path contains \"/wp-\") or (http.request.uri.path contains \".sql\") or (http.request.uri.path contains \".toml\") or (http.request.uri.path contains \".yml\") or (http.request.uri.path contains \".yaml\") or (http.request.uri.path contains \"/*\") or (http.host eq \"service.chia1104.dev\" and not starts_with(http.request.uri.path, \"/api/v1/\"))"
      action      = "block"
      enabled     = true
    },
    {
      ref         = "4c1bfc8990fb4e5d9684c412fea6cbc1"
      description = "og unfurler skip"
      expression  = "(http.user_agent contains \"facebookexternalhit\") or (http.user_agent contains \"Facebot\") or (http.user_agent contains \"Twitterbot\") or (http.user_agent contains \"Slackbot\") or (http.user_agent contains \"Discordbot\") or (http.user_agent contains \"TelegramBot\") or (http.user_agent contains \"WhatsApp\") or (http.user_agent contains \"LinkedInBot\") or (http.user_agent contains \"SkypeUriPreview\") or (http.user_agent contains \"Bluesky\") or (http.user_agent contains \"Mastodon\") or (http.user_agent contains \"redditbot\") or (http.user_agent contains \"Iframely\") or (http.user_agent contains \"Embedly\")"
      action      = "skip"
      action_parameters = {
        ruleset = "current"
      }
      logging = {
        enabled = true
      }
      enabled = true
    },
    {
      ref         = "48c996fa63f147c3a42849d139a6578a"
      description = "datacenter asn challenge"
      expression  = "(ip.geoip.asnum in {8075 138915 37963 45090 55990 16550 15169 14061 396362 45102 395954 51167 211298 396982 209854})"
      action      = "managed_challenge"
      enabled     = true
    },
    {
      ref         = "5a8b03aa9ec34451a9f77ed4adf43304"
      description = "non-browser challenge"
      expression  = "(not http.request.version in {\"HTTP/3\" \"HTTP/2\"}) and (http.host in {\"chia1104.dev\" \"www.chia1104.dev\"}) and (not starts_with(http.request.uri.path, \"/_next/\"))"
      action      = "managed_challenge"
      enabled     = true
    },
  ]
}

resource "cloudflare_ruleset" "managed_firewall" {
  zone_id = local.zone_id
  name    = "default"
  kind    = "zone"
  phase   = "http_request_firewall_managed"
  rules = [
    {
      ref         = "84d38c785104409e8446c8fbee02800a"
      description = "CF Bypass Token"
      expression  = "(any(http.request.headers[\"x-cf-bypass-token\"][*] eq \"${var.cf_bypass_token}\"))"
      action      = "skip"
      action_parameters = {
        ruleset = "current"
      }
      logging = {
        enabled = true
      }
      enabled = true
    },
  ]
}

resource "cloudflare_ruleset" "rate_limit" {
  zone_id = local.zone_id
  name    = "default"
  kind    = "zone"
  phase   = "http_ratelimit"
  rules = [
    {
      ref         = "314c4818b0a4418b9fbe4dc0c6fe81b7"
      description = "auth rate limit"
      expression  = "(http.host eq \"service.chia1104.dev\" and starts_with(http.request.uri.path, \"/api/v1/auth/\"))"
      action      = "block"
      ratelimit = {
        characteristics     = ["cf.colo.id", "ip.src"]
        mitigation_timeout  = 10
        period              = 10
        requests_per_period = 20
      }
      enabled = true
    },
  ]
}

resource "cloudflare_ruleset" "redirects" {
  zone_id = local.zone_id
  name    = "default"
  kind    = "zone"
  phase   = "http_request_dynamic_redirect"
  rules = [
    {
      ref         = "6984ad73eb3842f5bd345e0f7187b35a"
      description = "renamed tag typescripy (zh-TW)"
      expression  = "(http.host in {\"chia1104.dev\" \"www.chia1104.dev\"}) and lower(http.request.uri.path) in {\"/tags/typescripy\" \"/tags/typescripy/\" \"/zh-tw/tags/typescripy\" \"/zh-tw/tags/typescripy/\"}"
      action      = "redirect"
      action_parameters = {
        from_value = {
          preserve_query_string = true
          status_code           = 301
          target_url = {
            value = "https://chia1104.dev/tags/typescript"
          }
        }
      }
      enabled = true
    },
    {
      ref         = "c89d2a69e2f14cd08846516ee9c7f618"
      description = "renamed tag typescripy (en-US)"
      expression  = "(http.host in {\"chia1104.dev\" \"www.chia1104.dev\"}) and lower(http.request.uri.path) in {\"/en-us/tags/typescripy\" \"/en-us/tags/typescripy/\"}"
      action      = "redirect"
      action_parameters = {
        from_value = {
          preserve_query_string = true
          status_code           = 301
          target_url = {
            value = "https://chia1104.dev/en-US/tags/typescript"
          }
        }
      }
      enabled = true
    },
    {
      ref         = "0a7aca114d4c4dd49f23cc8843c14277"
      description = "strip default locale prefix"
      expression  = "(http.host in {\"chia1104.dev\" \"www.chia1104.dev\"}) and (lower(http.request.uri.path) eq \"/zh-tw\" or starts_with(lower(http.request.uri.path), \"/zh-tw/\")) and not http.request.uri.path contains \"/opengraph-image\""
      action      = "redirect"
      action_parameters = {
        from_value = {
          preserve_query_string = true
          status_code           = 301
          target_url = {
            expression = "concat(\"https://chia1104.dev\", substring(http.request.uri.path, 6))"
          }
        }
      }
      enabled = true
    },
    {
      ref         = "fda7896878b94a809be436e9969c3a1d"
      description = "www to apex"
      expression  = "(http.host eq \"www.chia1104.dev\")"
      action      = "redirect"
      action_parameters = {
        from_value = {
          preserve_query_string = true
          status_code           = 301
          target_url = {
            expression = "concat(\"https://chia1104.dev\", http.request.uri.path)"
          }
        }
      }
      enabled = true
    },
  ]
}

resource "cloudflare_ruleset" "cache" {
  zone_id = local.zone_id
  name    = "default"
  kind    = "zone"
  phase   = "http_request_cache_settings"
  rules = [
    {
      ref         = "a759f95a9ff247b6bad41627c8d58c49"
      description = "opengraph-image edge cache"
      expression  = "(http.host in {\"chia1104.dev\" \"www.chia1104.dev\"} and http.request.uri.path contains \"/opengraph-image\")"
      action      = "set_cache_settings"
      action_parameters = {
        browser_ttl = {
          mode = "respect_origin"
        }
        cache = true
        edge_ttl = {
          default = 86400
          mode    = "override_origin"
          status_code_ttl = [
            {
              status_code_range = {
                from = 300
              }
              value = -1
            },
          ]
        }
      }
      enabled = true
    },
    {
      ref         = "861a12979b3d454c927fa149b21b083d"
      description = "service shared reads edge cache"
      expression  = "(http.host eq \"service.chia1104.dev\" and http.request.method eq \"GET\" and starts_with(http.request.uri.path, \"/api/v1/rpc/\"))"
      action      = "set_cache_settings"
      action_parameters = {
        browser_ttl = {
          mode = "respect_origin"
        }
        cache = true
        edge_ttl = {
          mode = "bypass_by_default"
        }
      }
      enabled = true
    },
  ]
}
