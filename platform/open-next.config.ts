import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const cloudflareConfig = defineCloudflareConfig();
cloudflareConfig.buildCommand =
  "node scripts/prebuild.mjs && CLOUDFLARE_BUILD=true next build --webpack";

export default cloudflareConfig;