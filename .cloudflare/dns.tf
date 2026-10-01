# `ttl = 1` is automatic. Every entry carries every field so the map has one type.

locals {
  dns_records = {
    apex_a = {
      type     = "A"
      name     = "chia1104.dev"
      content  = "76.76.21.21"
      proxied  = true
      ttl      = 1
      priority = null
      comment  = null
      settings = null
    }
    apex_mx_route1 = {
      type     = "MX"
      name     = "chia1104.dev"
      content  = "route1.mx.cloudflare.net"
      proxied  = false
      ttl      = 1
      priority = 29
      comment  = null
      settings = null
    }
    apex_mx_route2 = {
      type     = "MX"
      name     = "chia1104.dev"
      content  = "route2.mx.cloudflare.net"
      proxied  = false
      ttl      = 1
      priority = 64
      comment  = null
      settings = null
    }
    apex_mx_route3 = {
      type     = "MX"
      name     = "chia1104.dev"
      content  = "route3.mx.cloudflare.net"
      proxied  = false
      ttl      = 1
      priority = 45
      comment  = null
      settings = null
    }
    apex_spf_txt = {
      type     = "TXT"
      name     = "chia1104.dev"
      content  = "\"v=spf1 include:_spf.mx.cloudflare.net ~all\""
      proxied  = false
      ttl      = 1
      priority = null
      comment  = null
      settings = null
    }
    atproto_txt = {
      type     = "TXT"
      name     = "_atproto.chia1104.dev"
      content  = "\"did=did:plc:vcdnqauiimkjvn7pdnllq7ob\""
      proxied  = false
      ttl      = 1
      priority = null
      comment  = "bluesky"
      settings = null
    }
    cloudflare_dkim_txt = {
      type     = "TXT"
      name     = "cf2024-1._domainkey.chia1104.dev"
      content  = "\"v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiweykoi+o48IOGuP7GR3X0MOExCUDY/BCRHoWBnh3rChl7WhdyCxW3jgq1daEjPPqoi7sJvdg5hEQVsgVRQP4DcnQDVjGMbASQtrY4WmB1VebF+RPJB2ECPsEDTpeiI5ZyUAwJaVX7r6bznU67g7LvFq35yIo4sdlmtZGV+i0H4cpYH9+3JJ78k\" \"m4KXwaf9xUJCWF6nxeD+qG6Fyruw1Qlbds2r85U9dkNDVAS3gioCvELryh1TxKGiVTkg4wqHTyHfWsp7KD3WQHYJn0RyfJJu6YEmL77zonn7p2SRMvTMP3ZEXibnC9gz3nnhR6wcYL8Q7zXypKTMD58bTixDSJwIDAQAB\""
      proxied  = false
      ttl      = 1
      priority = null
      comment  = null
      settings = null
    }
    dash_cname = {
      type     = "CNAME"
      name     = "dash.chia1104.dev"
      content  = "2z3qncia.up.railway.app"
      proxied  = true
      ttl      = 1
      priority = null
      comment  = null
      settings = {
        flatten_cname = false
      }
    }
    discord_txt = {
      type     = "TXT"
      name     = "_discord.chia1104.dev"
      content  = "\"dh=ad81656798425386210377ab198345aaacc3dd4b\""
      proxied  = false
      ttl      = 1
      priority = null
      comment  = "Discord"
      settings = null
    }
    dmarc_txt = {
      type     = "TXT"
      name     = "_dmarc.chia1104.dev"
      content  = "\"v=DMARC1; p=none; rua=mailto:d8f48fdd9d204b358e8b2b247d6ef050@dmarc-reports.cloudflare.net;\""
      proxied  = false
      ttl      = 1
      priority = null
      comment  = null
      settings = null
    }
    google_site_verification_txt = {
      type     = "TXT"
      name     = "chia1104.dev"
      content  = "\"google-site-verification=h72b0diYii6-HhsmAQohSHmHsbDSe_DjdM6MCAWkY9E\""
      proxied  = false
      ttl      = 3600
      priority = null
      comment  = null
      settings = null
    }
    link_cname = {
      type     = "CNAME"
      name     = "link.chia1104.dev"
      content  = "cname.dub.co"
      proxied  = false
      ttl      = 1
      priority = null
      comment  = null
      settings = {
        flatten_cname = false
      }
    }
    notify_cname = {
      type     = "CNAME"
      name     = "notify.chia1104.dev"
      content  = "hnd1.cname.zeabur-dns.com"
      proxied  = false
      ttl      = 1
      priority = null
      comment  = null
      settings = {
        flatten_cname = false
      }
    }
    railway_verify_dash_txt = {
      type     = "TXT"
      name     = "_railway-verify.dash.chia1104.dev"
      content  = "\"railway-verify=6283927fa42a49500d2ec326309a15befefdb4e46dc748e9b0952066e4a00447\""
      proxied  = false
      ttl      = 3600
      priority = null
      comment  = null
      settings = null
    }
    railway_verify_service_txt = {
      type     = "TXT"
      name     = "_railway-verify.service.chia1104.dev"
      content  = "\"railway-verify=eb6dafe8afd5caaf7d3031e1a3215af93ff56feb3696fafa0e165b336d49043a\""
      proxied  = false
      ttl      = 3600
      priority = null
      comment  = null
      settings = null
    }
    resend_dkim_notify_txt = {
      type     = "TXT"
      name     = "resend._domainkey.notify.chia1104.dev"
      content  = "\"p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC0e0wCvbC0V8iKXqqNJQRO1x+H9BWTf3Otc32mmdeuuL+FKJTQZ5Xj0Y2ujuAnCDt5zpoPx7iTnpliidKT+7ZWeAwbxfZzBW2sgD+p3jCsgi2e6q2UkJTMIYdpmuyDari2WOoNRoDyPAzIH3rtz+i3CXP+skQWp1cVHSpplqXGQQIDAQAB\""
      proxied  = false
      ttl      = 3600
      priority = null
      comment  = null
      settings = null
    }
    resend_dkim_txt = {
      type     = "TXT"
      name     = "resend._domainkey.chia1104.dev"
      content  = "\"p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDU9GV4EHYWgrI8BtzeiDaBlduftnMdX3mN5BLLv9fIybCp9mDUNqvJYsV7qP6CjfSmtOf+7kR/KWsJHqMDHilUtNkJYOVvVzM1HY/FHLHswYZYzFYep9+NVC5AeG5QmLkN1A7ySS5a9CqiE9Gr/YOGzbblTCR8mTKgpzxs6iUf6QIDAQAB\""
      proxied  = false
      ttl      = 3600
      priority = null
      comment  = "resend"
      settings = null
    }
    send_mx = {
      type     = "MX"
      name     = "send.chia1104.dev"
      content  = "feedback-smtp.ap-northeast-1.amazonses.com"
      proxied  = false
      ttl      = 3600
      priority = 10
      comment  = "resend"
      settings = null
    }
    send_notify_mx = {
      type     = "MX"
      name     = "send.notify.chia1104.dev"
      content  = "feedback-smtp.ap-northeast-1.amazonses.com"
      proxied  = false
      ttl      = 3600
      priority = 10
      comment  = null
      settings = null
    }
    send_notify_spf_txt = {
      type     = "TXT"
      name     = "send.notify.chia1104.dev"
      content  = "\"v=spf1 include:amazonses.com -all\""
      proxied  = false
      ttl      = 3600
      priority = null
      comment  = null
      settings = null
    }
    send_spf_txt = {
      type     = "TXT"
      name     = "send.chia1104.dev"
      content  = "\"v=spf1 include:amazonses.com -all\""
      proxied  = false
      ttl      = 3600
      priority = null
      comment  = "resend"
      settings = null
    }
    service_cname = {
      type     = "CNAME"
      name     = "service.chia1104.dev"
      content  = "jrvbw3u8.up.railway.app"
      proxied  = true
      ttl      = 1
      priority = null
      comment  = null
      settings = {
        flatten_cname = false
      }
    }
    status_cname = {
      type     = "CNAME"
      name     = "status.chia1104.dev"
      content  = "statuspage.betteruptime.com"
      proxied  = false
      ttl      = 1
      priority = null
      comment  = null
      settings = {
        flatten_cname = false
      }
    }
    storage_cname = {
      type     = "CNAME"
      name     = "storage.chia1104.dev"
      content  = "public.r2.dev"
      proxied  = true
      ttl      = 1
      priority = null
      comment  = null
      settings = {
        flatten_cname = false
      }
    }
    www_cname = {
      type     = "CNAME"
      name     = "www.chia1104.dev"
      content  = "cname.vercel-dns.com"
      proxied  = true
      ttl      = 1
      priority = null
      comment  = null
      settings = {
        flatten_cname = false
      }
    }
  }
}

resource "cloudflare_dns_record" "this" {
  for_each = local.dns_records

  zone_id  = local.zone_id
  type     = each.value.type
  name     = each.value.name
  content  = each.value.content
  proxied  = each.value.proxied
  ttl      = each.value.ttl
  priority = each.value.priority
  comment  = each.value.comment
  settings = each.value.settings
}
