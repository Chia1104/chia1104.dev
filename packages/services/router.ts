import { agentRouter } from "./agent/agent.route";
import { apikeyRouter } from "./apikey/apikey.route";
import { dashboardRouter } from "./dashboard/dashboard.route";
import { emailRouter } from "./email/email.route";
import { feedsRouter } from "./feeds/feeds.route";
import { fileRouter } from "./file/file.route";
import { healthRouter } from "./health/health.route";
import { memoryRouter } from "./memory/memory.route";
import { profileRouter } from "./profile/profile.route";
import { ragRouter } from "./rag/rag.route";
import { reportsRouter } from "./reports/reports.route";
import { contractOS } from "./shared/context";
import { spotifyRouter } from "./spotify/spotify.route";
import { tagsRouter } from "./tags/tags.route";
import { toolingsRouter } from "./toolings/toolings.route";
import { userRouter } from "./user/user.route";

export const router = contractOS.router({
  agent: agentRouter,
  dashboard: dashboardRouter,
  health: healthRouter,
  apikey: apikeyRouter,
  user: userRouter,
  feeds: feedsRouter,
  file: fileRouter,
  toolings: toolingsRouter,
  email: emailRouter,
  rag: ragRouter,
  memory: memoryRouter,
  profile: profileRouter,
  spotify: spotifyRouter,
  reports: reportsRouter,
  tags: tagsRouter,
});
