export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureDuelServer } = await import("./lib/clash/server/duel-server");
    ensureDuelServer();
  }
}
