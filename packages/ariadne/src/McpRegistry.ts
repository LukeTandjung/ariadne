/**
 * The `McpRegistry` module provides types and constructors for specifying
 * hosted MCP (Model Context Protocol) servers that can be used with AI
 * providers that support server-side MCP tool execution.
 *
 * This module is distinct from `McpServer` which is for running local MCP
 * servers. The `McpRegistry` module is for specifying remote/hosted MCP
 * servers that the AI provider will connect to and execute tools on your
 * behalf.
 *
 * @example
 * ```ts
 * import { McpRegistry, LanguageModel } from "@effect/ai"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const response = yield* LanguageModel.generateText({
 *     prompt: "Search for Effect TypeScript tutorials",
 *     mcpServers: [
 *       McpRegistry.marketplace("dedalus-labs/brave-search"),
 *       McpRegistry.url("https://my-custom-mcp.example.com"),
 *     ],
 *   })
 *
 *   return response.text
 * })
 * ```
 *
 * @since 1.0.0
 */

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Represents an MCP server specified by URL.
 *
 * Use this for self-hosted MCP servers or any MCP server accessible via a URL.
 *
 * @example
 * ```ts
 * import { McpRegistry } from "@effect/ai"
 *
 * const server = McpRegistry.url("https://mcp.example.com")
 * ```
 *
 * @since 1.0.0
 * @category Models
 */
export interface UrlMcpServer {
  readonly _tag: "url";
  readonly url: string;
}

/**
 * Represents an MCP server from a marketplace/registry.
 *
 * Use this for MCP servers hosted on a provider's marketplace, specified by
 * a slug like "owner/repo" or a simple identifier.
 *
 * @example
 * ```ts
 * import { McpRegistry } from "@effect/ai"
 *
 * const server = McpRegistry.marketplace("dedalus-labs/brave-search")
 * ```
 *
 * @since 1.0.0
 * @category Models
 */
export interface MarketplaceMcpServer {
  readonly _tag: "marketplace";
  readonly id: string;
}

/**
 * A specification for an MCP server, either by URL or marketplace ID.
 *
 * @since 1.0.0
 * @category Models
 */
export type McpServerSpec = UrlMcpServer | MarketplaceMcpServer;

// =============================================================================
// Constructors
// =============================================================================

/**
 * Creates an MCP server specification from a URL.
 *
 * @example
 * ```ts
 * import { McpRegistry } from "@effect/ai"
 *
 * const server = McpRegistry.url("https://mcp.example.com")
 * ```
 *
 * @since 1.0.0
 * @category Constructors
 */
export const url = (url: string): McpServerSpec => ({ _tag: "url", url });

/**
 * Creates an MCP server specification from a marketplace ID or slug.
 *
 * @example
 * ```ts
 * import { McpRegistry } from "@effect/ai"
 *
 * // Using owner/repo format
 * const braveSearch = McpRegistry.marketplace("dedalus-labs/brave-search")
 *
 * // Using simple slug
 * const weather = McpRegistry.marketplace("weather-mcp")
 * ```
 *
 * @since 1.0.0
 * @category Constructors
 */
export const marketplace = (id: string): McpServerSpec => ({
  _tag: "marketplace",
  id,
});

/**
 * Creates a collection of MCP server specifications.
 *
 * @example
 * ```ts
 * import { McpRegistry } from "@effect/ai"
 *
 * const servers = McpRegistry.make([
 *   McpRegistry.url("https://mcp.example.com"),
 *   McpRegistry.marketplace("dedalus-labs/brave-search"),
 *   McpRegistry.marketplace("weather-mcp"),
 * ])
 * ```
 *
 * @since 1.0.0
 * @category Constructors
 */
export const make = (
  servers: Iterable<McpServerSpec>,
): ReadonlyArray<McpServerSpec> => Array.from(servers);

// =============================================================================
// Utilities
// =============================================================================

/**
 * Converts an array of MCP server specifications to the API format (strings).
 *
 * URL servers are converted to their URL string, marketplace servers are
 * converted to their ID string.
 *
 * @example
 * ```ts
 * import { McpRegistry } from "@effect/ai"
 *
 * const servers = [
 *   McpRegistry.url("https://mcp.example.com"),
 *   McpRegistry.marketplace("dedalus-labs/brave-search"),
 * ]
 *
 * const apiFormat = McpRegistry.toApiFormat(servers)
 * // ["https://mcp.example.com", "dedalus-labs/brave-search"]
 * ```
 *
 * @since 1.0.0
 * @category Utilities
 */
export const toApiFormat = (
  servers: ReadonlyArray<McpServerSpec>,
): Array<string> =>
  servers.map((server) => (server._tag === "url" ? server.url : server.id));

/**
 * Type guard to check if a value is a URL MCP server.
 *
 * @since 1.0.0
 * @category Guards
 */
export const isUrl = (server: McpServerSpec): server is UrlMcpServer =>
  server._tag === "url";

/**
 * Type guard to check if a value is a marketplace MCP server.
 *
 * @since 1.0.0
 * @category Guards
 */
export const isMarketplace = (
  server: McpServerSpec,
): server is MarketplaceMcpServer => server._tag === "marketplace";
