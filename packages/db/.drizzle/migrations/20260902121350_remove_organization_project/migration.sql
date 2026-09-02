ALTER TABLE "chia_apikey" DROP CONSTRAINT "chia_apikey_project_id_chia_project_id_fk";--> statement-breakpoint
ALTER TABLE "chia_invitation" DROP CONSTRAINT "chia_invitation_organization_id_chia_organization_id_fk";--> statement-breakpoint
ALTER TABLE "chia_member" DROP CONSTRAINT "chia_member_organization_id_chia_organization_id_fk";--> statement-breakpoint
ALTER TABLE "chia_project" DROP CONSTRAINT "chia_project_organization_id_chia_organization_id_fk";--> statement-breakpoint
DROP TABLE "chia_invitation";--> statement-breakpoint
DROP TABLE "chia_member";--> statement-breakpoint
DROP TABLE "chia_organization";--> statement-breakpoint
DROP TABLE "chia_project";--> statement-breakpoint
DROP INDEX "apikey_project_id_idx";--> statement-breakpoint
ALTER TABLE "chia_apikey" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "chia_session" DROP COLUMN "active_organization_id";--> statement-breakpoint
DROP TYPE "invitation_status";--> statement-breakpoint
DROP TYPE "member_role";