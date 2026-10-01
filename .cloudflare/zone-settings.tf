# Only settings that differ from Cloudflare's defaults; the rest are left unmanaged.
locals {
  zone_settings = {
    ssl                 = "strict"
    security_level      = "high"
    rocket_loader       = "off"
    hotlink_protection  = "on"
    ipv6                = "on"
    opportunistic_onion = "off"
    transformations     = "open"
    # In `open` mode this list replaces the same-zone default, so it must name the site host and storage.
    transformations_allowed_origins = "chia1104.dev,www.chia1104.dev,storage.chia1104.dev,i.scdn.co,opengraph.githubassets.com,repository-images.githubusercontent.com"
  }
}

resource "cloudflare_zone_setting" "this" {
  for_each = local.zone_settings

  zone_id    = local.zone_id
  setting_id = each.key
  value      = each.value
}

resource "cloudflare_zone_setting" "security_header" {
  zone_id    = local.zone_id
  setting_id = "security_header"
  value = {
    strict_transport_security = {
      enabled            = true
      max_age            = 15552000
      include_subdomains = true
      preload            = true
      nosniff            = true
    }
  }
}
