# DB Schema

## Entity Relationship Diagram

```mermaid
erDiagram
    %% ==========================================
    %% Users & Auth
    %% ==========================================

    users {
        text id PK
        text name
        text email UK
        boolean email_verified
        text image
        enum role
        timestamp created_at
        timestamp updated_at
        boolean banned
        text ban_reason
        timestamp ban_expires
    }

    session {
        text id PK
        timestamp expires_at
        text token UK
        timestamp created_at
        timestamp updated_at
        text ip_address
        text user_agent
        text user_id FK
    }

    account {
        text id PK
        text account_id
        text provider_id
        text user_id FK
        text access_token
        text refresh_token
        text id_token
        timestamp access_token_expires_at
        timestamp refresh_token_expires_at
        text scope
        text password
        timestamp created_at
        timestamp updated_at
    }

    verification {
        text id PK
        text identifier
        text value
        timestamp expires_at
        timestamp created_at
        timestamp updated_at
    }

    passkey {
        text id PK
        text name
        text public_key
        text user_id FK
        text credential_id UK
        integer counter
        text device_type
        boolean backed_up
        text transports
        timestamp created_at
    }

    users ||--o{ session : "has"
    users ||--o{ account : "has"
    users ||--o{ passkey : "has"

    %% ==========================================
    %% Organization & Projects
    %% ==========================================

    organization {
        text id PK
        text name
        text slug UK
        text logo
        timestamp created_at
        jsonb metadata
    }

    member {
        text id PK
        text organization_id FK
        text user_id FK
        enum role
        timestamp created_at
    }

    invitation {
        text id PK
        text organization_id FK
        text email
        enum role
        enum status
        timestamp expires_at
        text inviter_id FK
        timestamp created_at
    }

    project {
        serial id PK
        text name
        text slug UK
        text logo
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
        jsonb metadata
        text organization_id FK
    }

    apikey {
        text id PK
        text name
        text start
        text prefix
        text key
        text user_id FK
        integer refill_interval
        integer refill_amount
        timestamp last_refill_at
        boolean rate_limit_enabled
        integer rate_limit_time_window
        integer rate_limit_max
        integer request_count
        integer remaining
        timestamp last_request
        boolean enabled
        timestamp expires_at
        timestamp created_at
        timestamp updated_at
        jsonb permissions
        jsonb metadata
        integer project_id FK
    }

    organization ||--o{ member : "has"
    organization ||--o{ invitation : "has"
    organization ||--o{ project : "has"
    users ||--o{ member : "belongs to"
    users ||--o{ invitation : "invites"
    users ||--o{ apikey : "owns"
    project ||--o{ apikey : "has"

    %% ==========================================
    %% Content Management (i18n)
    %% ==========================================

    tags {
        serial id PK
        text slug UK
        timestamp created_at
        timestamp updated_at
    }

    tag_translation {
        serial id PK
        integer tag_id FK
        enum locale
        text name
        text description
    }

    assets {
        serial id PK
        timestamp created_at
        timestamp updated_at
        text name
        text extension
        text url
        text user_id FK
    }

    feeds {
        serial id PK
        text slug UK
        enum type
        enum content_type
        boolean published
        enum default_locale
        timestamp created_at
        timestamp updated_at
        text user_id FK
        text main_image
    }

    feed_translation {
        serial id PK
        integer feed_id FK
        enum locale
        text title
        text excerpt
        text description
        text summary
        integer read_time
        vector embedding
        timestamp created_at
        timestamp updated_at
    }

    content {
        serial id PK
        integer feed_translation_id FK,UK
        text content
        text source
        text unstable_serialized_source
        timestamp created_at
        timestamp updated_at
    }

    assets_to_tags {
        integer asset_id PK,FK
        integer tag_id PK,FK
    }

    feeds_to_tags {
        integer feed_id PK,FK
        integer tag_id PK,FK
    }

    tags ||--o{ tag_translation : "has translations"
    tags ||--o{ assets_to_tags : "tagged"
    tags ||--o{ feeds_to_tags : "tagged"

    users ||--o{ assets : "owns"
    users ||--o{ feeds : "authors"

    assets ||--o{ assets_to_tags : "has tags"

    feeds ||--o{ feed_translation : "has translations"
    feeds ||--o{ feeds_to_tags : "has tags"

    feed_translation ||--|| content : "has content"
```

## Tables Overview

### Users & Authentication

| Table          | Description                             |
| -------------- | --------------------------------------- |
| `users`        | User accounts with roles and ban status |
| `session`      | Active user sessions with tokens        |
| `account`      | OAuth provider accounts linked to users |
| `verification` | Email/phone verification tokens         |
| `passkey`      | WebAuthn/FIDO2 passkey credentials      |

### Organization & Projects

| Table          | Description                          |
| -------------- | ------------------------------------ |
| `organization` | Organizations/teams                  |
| `member`       | Organization membership (user ↔ org) |
| `invitation`   | Pending organization invitations     |
| `project`      | Projects within organizations        |
| `apikey`       | API keys for projects/users          |

### Content Management (i18n Support)

| Table              | Description                                   |
| ------------------ | --------------------------------------------- |
| `tags`             | Language-agnostic tag identifiers             |
| `tag_translation`  | Localized tag names and descriptions          |
| `assets`           | Uploaded files/media                          |
| `feeds`            | Articles/notes (language-agnostic metadata)   |
| `feed_translation` | Localized feed content (title, excerpt, etc.) |
| `content`          | Full article content per translation          |
| `feed_meta`        | SEO metadata for feeds                        |
| `assets_to_tags`   | Asset ↔ Tag junction table                    |
| `feeds_to_tags`    | Feed ↔ Tag junction table                     |

## i18n Architecture

The content system uses a **translation table pattern** for full internationalization support:

```
Feed (language-agnostic)
  └── FeedTranslation (per locale: en, zh-tw)
        └── Content (full article body)
```

### Query Example

```typescript
// Get feed with Chinese translation
const feed = await db.query.feeds.findFirst({
  where: eq(feeds.slug, "my-article"),
  with: {
    translations: {
      where: eq(feedTranslations.locale, "zh-tw"),
      with: { content: true },
    },
  },
});
```

## Enums

| Enum                | Values                                       |
| ------------------- | -------------------------------------------- |
| `role`              | `admin`, `user`, `root`                      |
| `feed_type`         | `post`, `note`                               |
| `content_type`      | `mdx`, `notion`, `tiptap`, `plate`           |
| `i18n`              | `en`, `zh-tw`                                |
| `invitation_status` | `pending`, `accepted`, `rejected`, `expired` |
| `member_role`       | `owner`, `admin`, `member`                   |
