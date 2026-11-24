import { agentContract } from "./agent/agent.contract";
import { apikeyContract } from "./apikey/apikey.contract";
import { authContract } from "./auth/auth.contract";
import { dashboardContract } from "./dashboard/dashboard.contract";
import { emailContract } from "./email/email.contract";
import { feedsContract } from "./feeds/feeds.contract";
import { fileContract } from "./file/file.contract";
import { healthContract } from "./health/health.contract";
import { mediaContract } from "./media/media.contract";
import { memoryContract } from "./memory/memory.contract";
import { profileContract } from "./profile/profile.contract";
import { ragContract } from "./rag/rag.contract";
import { reportsContract } from "./reports/reports.contract";
import { spotifyContract } from "./spotify/spotify.contract";
import { tagsContract } from "./tags/tags.contract";
import { toolingsContract } from "./toolings/toolings.contract";
import { userContract } from "./user/user.contract";

export const routerContract = {
  agent: agentContract,
  dashboard: dashboardContract,
  health: healthContract,
  apikey: apikeyContract,
  auth: authContract,
  user: userContract,
  feeds: feedsContract,
  file: fileContract,
  toolings: toolingsContract,
  email: emailContract,
  rag: ragContract,
  memory: memoryContract,
  profile: profileContract,
  media: mediaContract,
  spotify: spotifyContract,
  reports: reportsContract,
  tags: tagsContract,
};
