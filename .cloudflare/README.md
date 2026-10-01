# Cloudflare configuration

Terraform manages the `chia1104.dev` zone: DNS records, the zone-level rulesets (custom and managed
WAF, rate limiting, single redirects, cache rules) and the zone settings that differ from
Cloudflare's defaults. State lives in the private R2 bucket `chia1104-terraform-state`.

## Credentials

| Variable                                     | Source                                                                                                                                                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`                       | API token scoped to the `chia1104.dev` zone with Zone Read, Zone Settings Edit, DNS Edit, Zone WAF Edit, Single Redirect Edit and Cache Rules Edit, plus Account Rulesets Edit and Account Filter Lists Edit for the cache rules |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | R2 API token with Object Read & Write on `chia1104-terraform-state`                                                                                                                                                              |
| `TF_VAR_cf_bypass_token`                     | The `CF_BYPASS_TOKEN` value www sends                                                                                                                                                                                            |

## Plan and apply

```bash
terraform -chdir=.cloudflare init
terraform -chdir=.cloudflare plan
terraform -chdir=.cloudflare apply
```

Change the zone here rather than in the dashboard or API: the next apply reverts any managed
resource to this configuration. Each ruleset owns every rule in its phase.

The `expression` of the two bypass rules shows as `(sensitive value)` in a plan; review edits to
it in the source diff.
