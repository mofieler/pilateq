# Multi-stage Dockerfile for Next.js standalone output
# Optimized for Coolify deployment

# ─── Dependencies Stage ────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat vips-dev
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install pnpm and dependencies
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile --prod=false

# ─── Builder Stage ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Increase Node.js heap size for builds with large type-checking
ENV NODE_OPTIONS="--max-old-space-size=4096"

# ── Build-time public variables (safe to bake into the client bundle) ─────────
# These are the ONLY variables that belong here as ARG/ENV.
# ⚠️  DO NOT add DATABASE_URL, AUTH_SECRET, STRIPE_*, RESEND_*, or any other
#     runtime secret as a build ARG — set those as Coolify environment variables
#     (runtime), not build arguments. Secrets in build args appear in docker
#     build logs and layer history in plain text.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN corepack enable pnpm && \
    pnpm run build

# ─── Runner Stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Ensure public directory has correct permissions for standalone mode
RUN chmod -R 755 /app/public 2>/dev/null || true && \
    chmod +x /app/scripts/*.sh 2>/dev/null || true

# Create avatars and storage upload directory and ensure nextjs user can write to it
RUN mkdir -p /app/public/avatars /app/storage/avatars && chown -R nextjs:nodejs /app/public/avatars /app/storage

# Persist uploaded avatars across container restarts
VOLUME ["/app/storage/avatars"]

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check for Coolify
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start the application
CMD ["node", "server.js"]
