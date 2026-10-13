const PLAYGROUND_URL = 'https://developer.amazon.com/ring/console/playground'

export function TokenHelp({ expired = false }: { expired?: boolean }) {
  return (
    <div className="space-y-2 text-base">
      <p>
        {expired
          ? 'Ring rejected the access token. Playground tokens last 30 minutes.'
          : 'Herald needs a Ring access token to show devices and live video.'}
      </p>
      <ol className="list-decimal space-y-1 pl-6">
        <li>
          Open the{' '}
          <a href={PLAYGROUND_URL} target="_blank" rel="noreferrer" className="font-bold text-accent underline underline-offset-4">
            Ring Developer Playground
            <span className="sr-only"> (opens in a new tab)</span>
          </a>{' '}
          and choose <strong>Generate token</strong>.
        </li>
        <li>
          Put it in <code className="rounded bg-canvas px-1.5 py-0.5">apps/web/.env.local</code> as{' '}
          <code className="rounded bg-canvas px-1.5 py-0.5">RING_ACCESS_TOKEN=…</code>
        </li>
        <li>The dev server reloads it on its own. Then refresh this page.</li>
      </ol>
    </div>
  )
}
