// Request router for the self-hosted edge-runtime container.
//
// Unlike the CLI (`supabase functions serve`), the bare edge-runtime image
// has no built-in per-function routing — it needs a "main service" that
// reads the first path segment (e.g. /functions/v1/stripe-webhook ->
// "stripe-webhook") and dispatches to that function's directory as an
// isolated worker. Kong strips the /functions/v1 prefix before this ever
// runs, so `pathname` here starts at the function name.
//
// JWT verification is intentionally NOT done here — Kong's key-auth plugin
// already gates every /functions/v1/* route except stripe-webhook (which
// verifies its own Stripe-Signature header instead of a Supabase JWT).

// deno-lint-ignore-file no-explicit-any
// @ts-ignore Deno global is injected by the edge-runtime, not resolvable by tsc
declare const EdgeRuntime: any

const HEADERS = { 'Content-Type': 'application/json' }

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS })
}

async function createWorker(servicePath: string) {
  return await EdgeRuntime.userWorkers.create({
    servicePath,
    memoryLimitMb: 256,
    workerTimeoutMs: 5 * 60 * 1000,
    noModuleCache: false,
    importMapPath: null,
    envVars: Object.entries(Deno.env.toObject()),
  })
}

// @ts-ignore Deno global is injected by the edge-runtime
Deno.serve(async (req: Request) => {
  const { pathname } = new URL(req.url)
  const functionName = pathname.split('/').filter(Boolean)[0]

  if (!functionName) {
    return jsonResponse({ error: 'missing function name in request path' }, 400)
  }

  const servicePath = `/home/deno/functions/${functionName}`

  try {
    const worker = await createWorker(servicePath)
    return await worker.fetch(req)
  } catch (err) {
    console.error(`[main] failed to serve "${functionName}":`, err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
