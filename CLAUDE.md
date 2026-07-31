# Working in this repo

## Every user-visible string is translated

The site runs in English and Simplified Chinese. Students switch with the
control at the top right, and the choice follows their account to any device.

**Do not write UI text in a page or component.** Add it to `lib/i18n/messages/`
and render it through `t()`:

```tsx
import { useLanguage } from '@/lib/i18n/LanguageProvider'

const { t } = useLanguage()
return <button aria-label={t('bubble.askQuestion')}>{t('bubble.ask')}</button>
```

`lib/i18n/catalog.ts` lists which message file each area belongs in. Both `en`
and `zh` are required — an empty `zh` renders English, which reads as a bug
rather than a fallback.

`npm test` fails if a file gains hardcoded English. See
`lib/__tests__/no-untranslated-ui.test.ts`, which also carries a `BASELINE` of
files that predate the rule; that list may shrink, never grow.

### Values inside a sentence

Use one key with a placeholder. Do not join fragments in JSX.

```tsx
t('myBubbles.expiresIn', { days: 3 })     // 'Expires in {days}d' / '{days} 天后过期'
```

Word order and spacing differ between the two languages, and a join in code
fixes both. `Baby ${species}` produced 幼年 龙 — Chinese writes 幼年龙 with no
space — and that could only be fixed by making the whole phrase one key.

### What is NOT translated

Anything a person typed: class names, challenge titles, hints, shop item names,
student solutions and comments. Those are database content, not UI.

Student-written posts are translated separately and on demand — see
`lib/i18n/useOnDemandTranslation.ts`. Challenge problems carry both languages in
their `.henryproblem` snapshot, and tag names have a row per language in
`challenge_tag_names`.

### Shipping a feature

Translate it in the same change. A feature that ships English-only leaves half a
page in the wrong language for every Chinese reader, and nobody finds out until
one of them says so.
