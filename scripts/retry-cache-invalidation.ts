import { processPendingInvalidations } from "../src/modules/cache/invalidate";

async function main() {
  const result = await processPendingInvalidations(50);
  console.log(JSON.stringify(result));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
