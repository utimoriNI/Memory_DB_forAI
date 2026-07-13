import { z } from "zod";
import { GitHubApiError, GitHubGitDataClient } from "./github/git-data-client.js";
import { PrefixedGitVaultGateway } from "./github/prefixed-gateway.js";
import { AdminVaultService } from "./vault/admin-vault-service.js";

interface AssetBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetBinding;
  ADMIN_ACCESS_TOKEN?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPOSITORY?: string;
  GITHUB_BRANCH?: string;
  GITHUB_VAULT_PATH?: string;
  GITHUB_TOKEN?: string;
}

const approveSchema = z.object({
  expectedHeadSha: z.string().min(1),
  acknowledgeHighRisk: z.boolean().default(false)
});
const rejectSchema = z.object({
  expectedHeadSha: z.string().min(1),
  reason: z.string().trim().min(3).max(500)
});
const inboxSchema = z.object({
  expectedHeadSha: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(20_000),
  source: z.string().trim().min(1).max(300)
});

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function constantTimeMatches(value: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(value)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let result = a.length === b.length ? 0 : 1;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    result |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return result === 0;
}

async function requireAuthentication(request: Request, env: Env): Promise<Response | null> {
  if (!env.ADMIN_ACCESS_TOKEN) {
    return json(
      { error: { code: "MISCONFIGURED", message: "Administrator access is not configured." } },
      503
    );
  }
  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!(await constantTimeMatches(token, env.ADMIN_ACCESS_TOKEN))) {
    return json({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, 401);
  }
  return null;
}

function serviceFor(env: Env): AdminVaultService {
  if (!env.GITHUB_OWNER || !env.GITHUB_REPOSITORY || !env.GITHUB_TOKEN) {
    throw new Error("GitHub Vault connection is not configured");
  }
  return new AdminVaultService(
    new PrefixedGitVaultGateway(
      new GitHubGitDataClient({
        owner: env.GITHUB_OWNER,
        repository: env.GITHUB_REPOSITORY,
        branch: env.GITHUB_BRANCH || "main",
        token: env.GITHUB_TOKEN
      }),
      env.GITHUB_VAULT_PATH || "memory"
    )
  );
}

async function requestJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("Expected a JSON request body");
  }
}

function proposalIdFor(pathname: string): string | null {
  const match = /^\/api\/proposals\/(mem_[A-Za-z0-9_-]{8,})(?:\/diff)?$/.exec(pathname);
  return match?.[1] ?? null;
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const authenticationError = await requireAuthentication(request, env);
  if (authenticationError) return authenticationError;
  const url = new URL(request.url);
  const service = serviceFor(env);
  if (request.method === "GET" && url.pathname === "/api/health") {
    return json({ ok: true });
  }
  if (request.method === "GET" && url.pathname === "/api/dashboard") {
    return json(await service.dashboard());
  }
  if (request.method === "GET" && url.pathname === "/api/proposals") {
    return json(await service.listProposals());
  }
  const id = proposalIdFor(url.pathname);
  if (request.method === "GET" && id) {
    const result = await service.getProposal(id);
    return json(
      url.pathname.endsWith("/diff") ? { headSha: result.headSha, diff: result.diff } : result
    );
  }
  if (
    request.method === "POST" &&
    /^\/api\/proposals\/mem_[A-Za-z0-9_-]{8,}\/approve$/.test(url.pathname)
  ) {
    const id = url.pathname.split("/")[3] ?? "";
    const body = approveSchema.parse(await requestJson(request));
    return json(await service.approve({ id, ...body }));
  }
  if (
    request.method === "POST" &&
    /^\/api\/proposals\/mem_[A-Za-z0-9_-]{8,}\/reject$/.test(url.pathname)
  ) {
    const id = url.pathname.split("/")[3] ?? "";
    const body = rejectSchema.parse(await requestJson(request));
    return json(await service.reject({ id, ...body }));
  }
  if (request.method === "POST" && url.pathname === "/api/inbox") {
    return json(await service.addInbox(inboxSchema.parse(await requestJson(request))), 201);
  }
  return json({ error: { code: "NOT_FOUND", message: "API route not found." } }, 404);
}

export async function tokenFingerprint(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

export function errorResponse(
  error: unknown,
  options: { tokenFingerprint?: string | null | undefined } = {}
): Response {
  if (error instanceof z.ZodError) {
    return json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "The submitted form is invalid.",
          details: error.flatten()
        }
      },
      400
    );
  }
  if (error instanceof GitHubApiError) {
    const status = error.status === 401 || error.status === 403 ? 502 : error.status;
    const providerError =
      error.status === 401
        ? {
            code: "GITHUB_AUTHENTICATION_FAILED",
            message: "GitHub rejected the Vault token. Replace GITHUB_TOKEN with a valid token."
          }
        : error.status === 403
          ? {
              code: "GITHUB_ACCESS_DENIED",
              message:
                "GitHub denied repository access. Check the token's Contents permission and any organization SSO approval."
            }
          : error.status === 404
            ? {
                code: "GITHUB_REPOSITORY_UNAVAILABLE",
                message:
                  "GitHub could not access the configured Vault repository or branch. Check GITHUB_OWNER, GITHUB_REPOSITORY, GITHUB_BRANCH, and token repository access."
              }
            : error.status === 429
              ? {
                  code: "GITHUB_RATE_LIMITED",
                  message:
                    "GitHub temporarily rate-limited the Vault request. Wait a few minutes and retry."
                }
              : {
                  code: "VAULT_PROVIDER_ERROR",
                  message: "The Vault provider could not complete this request. Try again later."
                };
    console.error(
      JSON.stringify({
        event: "github_vault_request_failed",
        status: error.status,
        retryable: error.retryable
      })
    );
    return json(
      {
        error:
          status === 409
            ? { code: "STALE_VIEW", message: error.message }
            : {
                ...providerError,
                ...(options.tokenFingerprint
                  ? { diagnostic: { workerTokenFingerprint: options.tokenFingerprint } }
                  : {})
              }
      },
      status
    );
  }
  const message = error instanceof Error ? error.message : "Unexpected request failure";
  const status =
    message.includes("not found") || message.includes("does not exist")
      ? 404
      : message.includes("requires explicit") || message.includes("changed since")
        ? 409
        : message.includes("not configured")
          ? 503
          : 400;
  return json({ error: { code: "REQUEST_REJECTED", message } }, status);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Referrer-Policy", "same-origin");
      headers.set(
        "Content-Security-Policy",
        "default-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'"
      );
      return new Response(response.body, { status: response.status, headers });
    }
    try {
      return await handleApi(request, env);
    } catch (error) {
      return errorResponse(error, { tokenFingerprint: await tokenFingerprint(env.GITHUB_TOKEN) });
    }
  }
};
