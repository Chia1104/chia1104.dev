terraform {
  required_version = ">= 1.11"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.26"
    }
  }

  # R2 through its S3 API; credentials come from AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.
  backend "s3" {
    bucket                      = "chia1104-terraform-state"
    key                         = "cloudflare/terraform.tfstate"
    region                      = "auto"
    endpoints                   = { s3 = "https://e122b389415d5086264cfa081ccdb0e8.r2.cloudflarestorage.com" }
    use_path_style              = true
    use_lockfile                = true
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
  }
}

# Authenticates with CLOUDFLARE_API_TOKEN.
provider "cloudflare" {}

locals {
  zone_id = "7490fff9a7c216b730b5b2d834b86425"
}

variable "cf_bypass_token" {
  description = "Value of the `x-cf-bypass-token` header that skips the WAF; the `CF_BYPASS_TOKEN` www sends."
  type        = string
  sensitive   = true
}
