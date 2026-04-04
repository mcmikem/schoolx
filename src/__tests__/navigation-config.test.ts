import { navigationByRole } from '@/lib/navigation'

describe('navigation config sanity', () => {
  it('does not reuse the same href for multiple labels within a role', () => {
    for (const [role, groups] of Object.entries(navigationByRole)) {
      const hrefToLabels = new Map<string, Set<string>>()

      groups.forEach(group => {
        group.items.forEach(item => {
          if (!hrefToLabels.has(item.href)) hrefToLabels.set(item.href, new Set())
          hrefToLabels.get(item.href)!.add(item.label)
        })
      })

      const conflicts = Array.from(hrefToLabels.entries()).filter(([, labels]) => labels.size > 1)
      expect(conflicts).toEqual([])
    }
  })
})

