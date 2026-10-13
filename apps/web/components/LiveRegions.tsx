// Always mounted: screen readers only watch live regions that exist before their text changes.
// Text in these regions is also what refreshable braille displays show.
export function LiveRegions({ assertive, polite }: { assertive: string; polite: string }) {
  return (
    <>
      <div role="alert" aria-atomic="true" className="sr-only">
        {assertive}
      </div>
      <div role="status" aria-atomic="true" className="sr-only">
        {polite}
      </div>
    </>
  )
}
