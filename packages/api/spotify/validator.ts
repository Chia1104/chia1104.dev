import { z } from "zod";

export const generateAuthorizeUrlSchema = z.object({
  state: z.string().min(1),
  scopes: z.array(z.string()).min(1),
  redirectUri: z.string().min(1),
  /**
   * @todo store client information
   */
  context: z.string().optional(),
});

export type GenerateAuthorizeUrlDTO = z.infer<
  typeof generateAuthorizeUrlSchema
>;

export const codeAuthorizationSchema = z.object({
  code: z.string().min(1),
  /**
   * @todo validate state
   */
  state: z.string().optional(),
  redirectUri: z.string().min(1),
});

export type CodeAuthorizationDTO = z.infer<typeof codeAuthorizationSchema>;
